#!/bin/sh
set -e

# Only substitute these specific variables — everything else (nginx's own
# $host, $remote_addr, $http_upgrade, etc.) is left untouched.
envsubst '${BACKEND_PORT} ${FRONTEND_PORT} ${NGINX_SERVER_NAME}' \
  < /etc/nginx/templates/nginx.conf.template \
  > /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'