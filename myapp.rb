require 'sinatra'
require 'sinatra-websocket'
require 'haml'
require 'memcached'
require 'yaml'
require 'ostruct'

CONFIG_FILEPATH = File.join(File.dirname(__FILE__), 'config', 'config.yml')
config = OpenStruct.new(YAML.load_file(CONFIG_FILEPATH))

set :server, 'thin'
set :sockets, []

get '/' do
  if !request.websocket?
    @hostname = config.hostname
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
          count = 0
          update = ''
        rescue => e
          warn e
        end
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
  t = Time.now.instance_eval {'%s.%03d' % [strftime('%Y/%m/%d+%H:%M:%S'), (usec / 1000.0).round]}
  # FIXME: There is missed in usec accuracy
  Memcached.new("#{config.memcached_host}:#{config.memcached_port}").set(t, 1)
end
