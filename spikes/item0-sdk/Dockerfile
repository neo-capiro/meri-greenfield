# Spike only. Root supplies an inspected ARM64 Node 24.22.1 image digest.
ARG NODE_IMAGE
FROM ${NODE_IMAGE}
WORKDIR /app/spikes/item0-sdk
COPY spikes/item0-sdk/package.json spikes/item0-sdk/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY spikes/item0-sdk/*.mjs ./
COPY spikes/item0-sdk/fixtures ./fixtures
COPY packages/skills /app/packages/skills
COPY apps/control/document-application/research-brief/SKILL.md /app/apps/control/document-application/research-brief/SKILL.md
RUN mkdir /scratch /evidence && chown node:node /scratch /evidence
USER node
ENTRYPOINT ["node", "run.mjs"]
CMD ["--help"]
