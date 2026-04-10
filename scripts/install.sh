#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/hivee-connector}
SERVICE_NAME=${SERVICE_NAME:-hivee-connector}
USER_NAME=${USER_NAME:-root}

mkdir -p "$APP_DIR"
cp -R . "$APP_DIR"
cd "$APP_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
fi

npm install
npm run build

cat >/etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=Hivee Connector
After=network.target

[Service]
Type=simple
User=${USER_NAME}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
ExecStart=/usr/bin/node ${APP_DIR}/dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}
echo "Installed ${SERVICE_NAME}. Visit http://127.0.0.1:43137"
