#!/bin/bash
# Get initial SSL certificate from Let's Encrypt
# Run on VPS after first deploy: bash /opt/chartici/deploy/init-ssl.sh

set -e
DOMAIN="chartici.com"
EMAIL="admin@chartici.com"

echo "=== Step 1: Start nginx with HTTP-only config (for ACME challenge) ==="

# Temporarily replace nginx.conf with HTTP-only version
cat > /tmp/nginx-http-only.conf << 'HTTPCONF'
server {
    listen 80;
    server_name chartici.com www.chartici.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
HTTPCONF

# Copy temp config into the running container
docker cp /tmp/nginx-http-only.conf chartici-web:/etc/nginx/conf.d/default.conf
docker exec chartici-web nginx -s reload

echo "=== Step 2: Request certificate ==="
docker compose -f /opt/chartici/docker-compose.yml run --rm certbot \
  certbot certonly --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --force-renewal

echo "=== Step 3: Restore full HTTPS nginx config ==="
docker compose -f /opt/chartici/docker-compose.yml down
docker compose -f /opt/chartici/docker-compose.yml up -d

echo "=== SSL setup complete! ==="
echo "Visit https://$DOMAIN to verify."
