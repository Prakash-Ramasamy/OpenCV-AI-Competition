#!/bin/sh
set -eu

: "${BACKEND_UPSTREAM:=http://backend:8000}"
export BACKEND_UPSTREAM

# Restrict substitution to this one application variable. This intentionally
# leaves Nginx runtime variables ($host, $scheme, $proxy_add_x_forwarded_for,
# etc.) intact for Nginx itself to evaluate after startup.
envsubst '${BACKEND_UPSTREAM}' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

rm -f /etc/nginx/conf.d/default.conf.template
