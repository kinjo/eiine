require 'sinatra'
require 'sinatra-websocket'
require 'haml'
require 'memcached'
require 'yaml'
require 'ostruct'
require 'uuidtools'
require 'mongo'

CONFIG_FILEPATH = File.join(File.dirname(__FILE__), 'config', 'config.yml')
config = OpenStruct.new(YAML.load_file(CONFIG_FILEPATH))

set :server, 'thin'
set :sockets, []

get '/' do
  if !request.websocket?
    @hostname = config.hostname

    @session_id = UUIDTools::UUID.random_create.to_s
    connect = Mongo::Connection.new config.mongo_host, config.mongo_port
    db = connect.db config.mongo_db
    collection = db.collection 'session_id'
    session = {session_id:@session_id, banned:false, update:Time.now.to_s, counter:0}
    collection.insert(session)

    cache = Memcached.new("#{config.memcached_host}:#{config.memcached_port}")
    cache.set "session_#{@session_id}", session

    haml :index
  else
    request.websocket do |ws|
      ws.onopen do
        settings.sockets << ws
      end
      ws.onmessage do |msg|
        cache = Memcached.new("#{config.memcached_host}:#{config.memcached_port}")
        begin
          count = cache.get('count', false)
          update = cache.get('update', false)
          if count.to_i > 0
            warn "count:#{count} update:#{update}"
          end
        rescue Memcached::NotFound => e
          warn e
          count = 0
          update = ''
        rescue => e
          warn e
        end
        warn "{count:#{count},update:\"#{update}\"}"
        if count.to_i > 0
          EM.next_tick { settings.sockets.each{|s| s.send("{count:#{count},update:\"#{update}\"}")} }
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
    cache = Memcached.new("#{config.memcached_host}:#{config.memcached_port}")
    begin
      session = cache.get "session_#{params[:session_id]}"
    rescue Memcached::NotFound => e
      # load to memcached from mongodb if session_id is not loaded
      connect = Mongo::Connection.new config.mongo_host, config.mongo_port
      db = connect.db config.mongo_db
      collection = db.collection 'session_id'
      session = collection.find({session_id:params[:session_id]}).first
      if session
        session.inject({}){|memo,(k,v)| memo[k.to_sym]=v; memo} # symbolify keys
        cache = Memcached.new("#{config.memcached_host}:#{config.memcached_port}")
        cache.set "session_#{session_id}", session
      end
    end
    if session and !session[:banned]
      now = Time.now.to_s
      if session[:update] == now
        # count requests per second
        session[:counter] += 1
        if session[:counter] > 20
          # ban
          session[:banned] = true
          connect = Mongo::Connection.new config.mongo_host, config.mongo_port
          db = connect.db config.mongo_db
          collection = db.collection 'session_id'
          collection.update({_id:session[:_id]}, session)
        end
      else
        session[:update] = now
        session[:counter] = 0
      end
      # update session on memcached
      cache.set "session_#{params[:session_id]}", session

      t = Time.now.instance_eval {'%s.%03d' % [strftime('%Y/%m/%d+%H:%M:%S'), (usec / 1000.0).round]}
      # FIXME: There is missed in usec accuracy
      Memcached.new("#{config.memcached_host}:#{config.memcached_port}").set(t, 1)
    end
  end
end
