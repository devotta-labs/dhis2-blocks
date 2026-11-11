FROM node:24.11.1-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git ripgrep \
    && rm -rf /var/lib/apt/lists/*
# Latest stable on 2026-11-09. Native CLI, not libfx or the embedded adapter.
RUN set -eu; case "$(uname -m)" in \
      aarch64) arch=aarch64; sha=ca9441b104357e2105039dbfd4c2eaf0d6ee65a84085f23f51e880c95cbf46af ;; \
      x86_64) arch=x86_64; sha=f0fb822c7be546c80bcc89d50521bc1454435e0c6f586e8420c4e2b84fa80599 ;; \
      *) exit 1 ;; esac; \
    curl -fsSL "https://releases.fx.sh/v0.0.16/fx-linux-${arch}.tar.gz" -o /tmp/fx.tar.gz; \
    echo "$sha  /tmp/fx.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/fx.tar.gz -C /usr/local/bin fx; rm /tmp/fx.tar.gz; fx --version
RUN npm install -g pnpm@10.13.1
COPY runtime /opt/blocks-sandbox
RUN ln -s /opt/blocks-sandbox/preview.mjs /usr/local/bin/sandbox-preview \
    && chmod +x /opt/blocks-sandbox/preview.mjs
RUN mkdir -p /sandbox/home /sandbox/app /sandbox/logs \
    && chown -R node:node /sandbox
ENV HOME=/sandbox/home SHELL=/bin/bash
USER node
WORKDIR /sandbox/app
EXPOSE 5173
CMD ["node", "/opt/blocks-sandbox/server.mjs"]
