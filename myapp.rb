require 'sinatra'
require 'sinatra-websocket'
require 'haml'
require 'memcached'
require 'yaml'
require 'ostruct'
require 'uuidtools'
require 'mongo'

CONFIG_FILEPATH = File.join(File.dirname(__FILE__), 'config', 'config.yml')

set :server, 'thin'
set :sockets, []
set :config, OpenStruct.new(YAML.load_file(CONFIG_FILEPATH))
set :acc, 0 # count iine until threshold reached

get '/button' do
  @hostname = settings.config.hostname

  @session_id = UUIDTools::UUID.random_create.to_s
  connect = Mongo::Connection.new settings.config.mongo_host, settings.config.mongo_port
  db = connect.db settings.config.mongo_db
  collection = db.collection 'session_id'
  session = {session_id:@session_id, banned:false, update:Time.now.to_s, counter:0}
  collection.insert(session)

  cache = Memcached.new("#{settings.config.memcached_host}:#{settings.config.memcached_port}")
  cache.set "session_#{@session_id}", session

  haml :button
end

get '/' do
  if !request.websocket?
    @hostname = settings.config.hostname

    @session_id = UUIDTools::UUID.random_create.to_s
    connect = Mongo::Connection.new settings.config.mongo_host, settings.config.mongo_port
    db = connect.db settings.config.mongo_db
    collection = db.collection 'session_id'
    session = {session_id:@session_id, banned:false, update:Time.now.to_s, counter:0}
    collection.insert(session)

    cache = Memcached.new("#{settings.config.memcached_host}:#{settings.config.memcached_port}")
    cache.set "session_#{@session_id}", session

    haml :index
  else
    request.websocket do |ws|
      ws.onopen do
        settings.sockets << ws
      end
      ws.onmessage do |msg|
        cache = Memcached.new("#{settings.config.memcached_host}:#{settings.config.memcached_port}")
        begin
          count = cache.get('count', false)
          update = cache.get('update', false)
        rescue Memcached::NotFound => e
          warn e
          count = 0
          update = ''
        rescue => e
          warn e
        end
        #warn "{count:#{count},update:\"#{update}\"}"
        if count.to_i > 0
          settings.acc += count.to_i
          if settings.acc > settings.config.effect_threshold
            # if threshold reached, set aftereffect to true
            EM.next_tick { settings.sockets.each{|s| s.send("{count:#{count},aftereffect:true,update:\"#{update}\"}")} }
            settings.acc = 0
          else
            EM.next_tick { settings.sockets.each{|s| s.send("{count:#{count},aftereffect:false,update:\"#{update}\"}")} }
          end
          begin
            cache.set 'count', '0', 0, false
          rescue Memcached::ServerIsMarkedDead => e
            warn e
          end
        end
      end
      ws.onclose do
        warn "wetbsocket closed"
        settings.sockets.delete(ws)
      end
    end
  end
end

post '/' do
  if params[:session_id]
    cache = Memcached.new("#{settings.config.memcached_host}:#{settings.config.memcached_port}")
    begin
      session = cache.get "session_#{params[:session_id]}"
    rescue Memcached::NotFound => e
      # load to memcached from mongodb if session_id is not loaded
      connect = Mongo::Connection.new settings.config.mongo_host, settings.config.mongo_port
      db = connect.db settings.config.mongo_db
      collection = db.collection 'session_id'
      session = collection.find({session_id:params[:session_id]}).first
      if session
        session.inject({}){|memo,(k,v)| memo[k.to_sym]=v; memo} # symbolify keys
        cache = Memcached.new("#{settings.config.memcached_host}:#{settings.config.memcached_port}")
        cache.set "session_#{params[:session_id]}", session
      end
    end
    begin
      banned = Time.parse(session['banned'])
    rescue
      banned = nil
    end
    now = Time.now
    if session and (!banned or now > banned)
      t = now.instance_eval {'%s.%03d' % [strftime('%Y/%m/%d+%H:%M:%S'), (usec / 1000.0).round]}
      # FIXME: There is missed in usec accuracy
      Memcached.new("#{settings.config.memcached_host}:#{settings.config.memcached_port}").set(t, {update:t, session_id:params[:session_id]})
    else
      warn "BANNED #{params[:session_id]}"
      403
    end
  end
end
