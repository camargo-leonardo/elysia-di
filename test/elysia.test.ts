import { Elysia } from 'elysia'
import { di, Lifecycle } from '../src'
import { describe, expect, it } from 'bun:test'

describe('Elysia DI Plugin', () => {
  it('should inject services into routes', async () => {
    class TestService {
      getMessage() {
        return 'Hello from DI'
      }
    }

    const app = new Elysia()
      .use(
        di({
          services: [
            {
              identifier: 'testService',
              factory: () => new TestService(),
            },
          ] as const,
        }),
      )
      .get('/test', ({ testService }) => {
        return { message: testService.getMessage() }
      })

    const response = await app.handle(new Request('http://localhost/test'))
    const data = await response.json()

    expect(data.message).toBe('Hello from DI')
  })

  it('should resolve dependencies between services', async () => {
    class DatabaseService {
      query() {
        return 'db_result'
      }
    }

    class UserService {
      constructor(private db: DatabaseService) {}
      
      getUser() {
        return { data: this.db.query() }
      }
    }

    const app = new Elysia()
      .use(
        di({
          services: [
            {
              identifier: 'database',
              factory: () => new DatabaseService(),
              lifecycle: Lifecycle.Singleton,
            },
            {
              identifier: 'userService',
              factory: (container) => {
                const db = container.resolve<DatabaseService>('database')
                return new UserService(db)
              },
            },
          ] as const,
        }),
      )
      .get('/user', ({ userService }) => {
        return userService.getUser()
      })

    const response = await app.handle(new Request('http://localhost/user'))
    const data = await response.json()

    expect(data.data).toBe('db_result')
  })

  it('should register classes', async () => {
    class TestService {
      value = 42
    }

    const app = new Elysia()
      .use(
        di({
          classes: [
            {
              identifier: 'testService',
              classConstructor: TestService,
            },
          ] as const,
        }),
      )
      .get('/test', ({ testService }) => {
        return { value: testService.value }
      })

    const response = await app.handle(new Request('http://localhost/test'))
    const data = await response.json()

    expect(data.value).toBe(42)
  })

  it('should register instances', async () => {
    const config = { apiKey: 'secret123' }

    const app = new Elysia()
      .use(
        di({
          instances: [
            {
              identifier: 'config',
              instance: config,
            },
          ] as const,
        }),
      )
      .get('/config', ({ config }) => {
        return config
      })

    const response = await app.handle(new Request('http://localhost/config'))
    const data = await response.json()

    expect(data.apiKey).toBe('secret123')
  })

  it('should handle scoped services per request', async () => {
    let instanceCount = 0

    class ScopedService {
      id: number
      constructor() {
        instanceCount++
        this.id = instanceCount
      }
    }

    const app = new Elysia()
      .use(
        di({
          services: [
            {
              identifier: 'scopedService',
              factory: () => new ScopedService(),
              lifecycle: Lifecycle.Scoped,
            },
          ] as const,
        }),
      )
      .get('/test', ({ scopedService }) => {
        const id1 = scopedService.id
        const id2 = scopedService.id
        return {
          id1,
          id2,
          same: id1 === id2,
        }
      })

    const response1 = await app.handle(new Request('http://localhost/test'))
    const data1 = await response1.json()

    const response2 = await app.handle(new Request('http://localhost/test'))
    const data2 = await response2.json()

    // Within the same request, should be the same instance
    expect(data1.same).toBe(true)
    expect(data2.same).toBe(true)

    // Different requests should have different instances
    expect(data1.id1).not.toBe(data2.id1)
  })

  it('should handle singleton services', async () => {
    let instanceCount = 0

    class SingletonService {
      id: number
      constructor() {
        instanceCount++
        this.id = instanceCount
      }
    }

    const app = new Elysia()
      .use(
        di({
          services: [
            {
              identifier: 'singletonService',
              factory: () => new SingletonService(),
              lifecycle: Lifecycle.Singleton,
            },
          ] as const,
        }),
      )
      .get('/test', ({ singletonService }) => {
        return { id: singletonService.id }
      })

    const response1 = await app.handle(new Request('http://localhost/test'))
    const data1 = await response1.json()

    const response2 = await app.handle(new Request('http://localhost/test'))
    const data2 = await response2.json()

    // Should be the same instance across requests
    expect(data1.id).toBe(data2.id)
    expect(instanceCount).toBe(1)
  })

  it('should work without scoping enabled', async () => {
    class TestService {
      getMessage() {
        return 'Hello'
      }
    }

    const app = new Elysia()
      .use(
        di({
          services: [
            {
              identifier: 'testService',
              factory: () => new TestService(),
            },
          ] as const,
          enableScoping: false,
        }),
      )
      .get('/test', ({ testService }) => {
        return { message: testService.getMessage() }
      })

    const response = await app.handle(new Request('http://localhost/test'))
    const data = await response.json()

    expect(data.message).toBe('Hello')
  })
})
