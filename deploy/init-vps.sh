#!/bin/bash
# Initial VPS setup for Chartici
# Run once: ssh root@76.13.8.204 'bash -s' < deploy/init-vps.sh

set -e

echo "=== Installing Docker ==="
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "=== Creating project directory ==="
mkdir -p /opt/chartici

echo "=== Docker version ==="
docker --version
docker compose version

echo "=== Done! Now push to main to trigger auto-deploy ==="
