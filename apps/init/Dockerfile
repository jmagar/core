ARG NODE_IMAGE=node:20.11.1-bullseye-slim@sha256:5a5a92b3a8d392691c983719dbdc65d9f30085d6dcd65376e7a32e6fe9bf4cbe

FROM ${NODE_IMAGE} AS pruner

WORKDIR /core

COPY --chown=node:node . .
RUN npx -q turbo@2.5.3 prune --scope=@redplanethq/init --docker
RUN find . -name "node_modules" -type d -prune -exec rm -rf '{}' +

# Base strategy to have layer caching
FROM ${NODE_IMAGE} AS base
RUN apt-get update && apt-get install -y openssl dumb-init postgresql-client
WORKDIR /core
COPY --chown=node:node .gitignore .gitignore
COPY --from=pruner --chown=node:node /core/out/json/ .
COPY --from=pruner --chown=node:node /core/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner --chown=node:node /core/out/pnpm-workspace.yaml ./pnpm-workspace.yaml

## Dev deps
FROM base AS dev-deps
WORKDIR /core
# Corepack is used to install pnpm
RUN corepack enable
ENV NODE_ENV development
RUN pnpm install --ignore-scripts --no-frozen-lockfile

## Production deps
FROM base AS production-deps
WORKDIR /core
# Corepack is used to install pnpm
RUN corepack enable
ENV NODE_ENV production
RUN pnpm install --prod --no-frozen-lockfile

## Builder (builds the init CLI)
FROM base AS builder
WORKDIR /core
# Corepack is used to install pnpm
RUN corepack enable

COPY --from=pruner --chown=node:node /core/out/full/ .
COPY --from=dev-deps --chown=node:node /core/ .
COPY --chown=node:node turbo.json turbo.json
COPY --chown=node:node .configs/tsconfig.base.json .configs/tsconfig.base.json
RUN pnpm run build --filter=@redplanethq/init...

# Runner
FROM ${NODE_IMAGE} AS runner
RUN apt-get update && apt-get install -y openssl postgresql-client ca-certificates
WORKDIR /core
RUN corepack enable
ENV NODE_ENV production

COPY --from=base /usr/bin/dumb-init /usr/bin/dumb-init
COPY --from=pruner --chown=node:node /core/out/full/ .
COPY --from=production-deps --chown=node:node /core .
COPY --from=builder --chown=node:node /core/apps/init/dist ./apps/init/dist

# Copy the trigger dump file
COPY --chown=node:node apps/init/trigger.dump ./apps/init/trigger.dump

# Copy and set up entrypoint script
COPY --chown=node:node apps/init/entrypoint.sh ./apps/init/entrypoint.sh
RUN chmod +x ./apps/init/entrypoint.sh

USER node
WORKDIR /core/apps/init
ENTRYPOINT ["dumb-init", "--"]
CMD ["./entrypoint.sh"]