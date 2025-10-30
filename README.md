# Elysia DI

A Dependency Injection plugin for [Elysia](https://elysiajs.com/) with full TypeScript support.

## Installation

```bash
bun add elysia-di
```

## Features

- 🎯 **Type-safe** - Full TypeScript support with automatic type inference
- 🔄 **Lifecycle Management** - Transient, Singleton, and Scoped lifecycles
- 🧩 **Flexible** - Register services, classes, or instances

## Quick Start

```typescript
import { Elysia } from "elysia";
import { di, Lifecycle } from "elysia-di";

// Define your services
class Logger {
  log(message: string) {
    console.log(message);
  }
}

class UserService {
  constructor(private logger: Logger) {}

  getUsers() {
    this.logger.log("Fetching users...");
    return [{ id: 1, name: "John" }];
  }
}

// Create your app with DI
const app = new Elysia()
  .use(
    di({
      classes: [
        {
          identifier: "logger",
          classConstructor: Logger,
          lifecycle: Lifecycle.Singleton,
        },
        {
          identifier: "userService",
          classConstructor: UserService,
          lifecycle: Lifecycle.Scoped,
        },
      ],
    })
  )
  .get("/users", ({ services }) => {
    const userService = services.userService;
    return userService.getUsers();
  })
  .listen(3000);
```

## API

### Registration Options

The `di()` plugin accepts three types of registrations:

#### 1. **Classes** - Register classes with automatic instantiation

```typescript
{
  classes: [
    {
      identifier: "myService",
      classConstructor: MyService,
      lifecycle: Lifecycle.Singleton, // optional
    },
  ];
}
```

#### 2. **Services** - Register with factory functions

```typescript
{
  services: [
    {
      identifier: "config",
      factory: (container) => ({
        apiUrl: process.env.API_URL,
      }),
      lifecycle: Lifecycle.Singleton,
    },
  ];
}
```

#### 3. **Instances** - Register pre-created instances

```typescript
{
  instances: [
    {
      identifier: "database",
      instance: new Database(),
    },
  ];
}
```

### Lifecycles

- **`Lifecycle.Transient`** - New instance on every request
- **`Lifecycle.Singleton`** - Single instance shared across all requests
- **`Lifecycle.Scoped`** - New instance per request (default for classes)

### Dependency Resolution

Dependencies are automatically resolved from the container. The constructor parameters are matched against registered identifiers:

```typescript
class UserService {
  constructor(private logger: Logger, private database: Database) {}
}
```

### Accessing

Services are available via the `identifier` context property:

```typescript
.get('/user', ({ userService }) => {
  const user = userService.get()
  // ...
})
```

## License

MIT
