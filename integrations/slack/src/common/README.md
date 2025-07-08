# IntegrationCLI Base Class

This is a common CLI base class that can be moved to the SDK and used by all integrations.

## Usage

### 1. Create your integration-specific CLI class:

```typescript
import { IntegrationCLI, IntegrationEventPayload } from './common/IntegrationCLI';

export class MyIntegrationCLI extends IntegrationCLI {
  constructor() {
    super('my-integration', '1.0.0');
  }

  protected async handleEvent(eventPayload: IntegrationEventPayload): Promise<any> {
    // Your integration-specific logic here
    return await processMyIntegrationEvent(eventPayload);
  }
}
```

### 2. Create your CLI entry point:

```typescript
#!/usr/bin/env node

import { MyIntegrationCLI } from './MyIntegrationCLI';

const cli = new MyIntegrationCLI();
cli.parse();
```

### 3. Update your package.json:

```json
{
  "bin": {
    "my-integration": "./dist/cli.js"
  },
  "dependencies": {
    "commander": "^12.0.0"
  }
}
```

## Available Commands

The base class provides these commands automatically:

- `account create --oauth-response <json> --integration-definition <json>`
- `account delete --account-id <id>`
- `process --event-data <json> --integration-account <json>`
- `identify --webhook-data <json>`
- `sync --integration-account <json>`

## Moving to SDK

To move this to the SDK:

1. Move `IntegrationCLI.ts` to `@redplanethq/sol-sdk/src/cli/`
2. Export it from the SDK's index
3. Update imports in integrations to use the SDK version
4. Add commander as a dependency to the SDK