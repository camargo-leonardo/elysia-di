import { describe, expect, it } from 'bun:test'
import { Container, Lifecycle } from '../src/container'

describe('Container', () => {
  it('should register and resolve a transient service', () => {
    const container = new Container()
    
    class TestService {
      id = Math.random()
    }

    container.register(
      'TestService',
      () => new TestService(),
      Lifecycle.Transient,
    )

    const instance1 = container.resolve<TestService>('TestService')
    const instance2 = container.resolve<TestService>('TestService')

    expect(instance1).toBeInstanceOf(TestService)
    expect(instance2).toBeInstanceOf(TestService)
    expect(instance1.id).not.toBe(instance2.id)
  })

  it('should register and resolve a singleton service', () => {
    const container = new Container()
    
    class TestService {
      id = Math.random()
    }

    container.registerSingleton('TestService', () => new TestService())

    const instance1 = container.resolve<TestService>('TestService')
    const instance2 = container.resolve<TestService>('TestService')

    expect(instance1).toBeInstanceOf(TestService)
    expect(instance2).toBeInstanceOf(TestService)
    expect(instance1.id).toBe(instance2.id)
  })

  it('should register and resolve a scoped service', () => {
    const container = new Container()
    
    class TestService {
      id = Math.random()
    }

    container.registerScoped('TestService', () => new TestService())

    const instance1 = container.resolve<TestService>('TestService')
    const instance2 = container.resolve<TestService>('TestService')

    expect(instance1).toBeInstanceOf(TestService)
    expect(instance2).toBeInstanceOf(TestService)
    expect(instance1.id).toBe(instance2.id)

    // Clear scope and resolve again - should get a new instance
    container.clearScope()
    const instance3 = container.resolve<TestService>('TestService')
    expect(instance3.id).not.toBe(instance1.id)
  })

  it('should register and resolve a class', () => {
    const container = new Container()
    
    class TestService {
      getMessage() {
        return 'Hello'
      }
    }

    container.registerClass('TestService', TestService)

    const instance = container.resolve<TestService>('TestService')
    expect(instance).toBeInstanceOf(TestService)
    expect(instance.getMessage()).toBe('Hello')
  })

  it('should register and resolve an instance', () => {
    const container = new Container()
    const instance = { value: 42 }

    container.registerInstance('Config', instance)

    const resolved = container.resolve<{ value: number }>('Config')
    expect(resolved).toBe(instance)
    expect(resolved.value).toBe(42)
  })

  it('should resolve dependencies from container', () => {
    const container = new Container()

    class DatabaseService {
      query() {
        return 'result'
      }
    }

    class UserService {
      constructor(private db: DatabaseService) {}
      
      getUser() {
        return this.db.query()
      }
    }

    container.registerSingleton(
      'DatabaseService',
      () => new DatabaseService(),
    )

    container.registerTransient(
      'UserService',
      (c) => new UserService(c.resolve('DatabaseService')),
    )

    const userService = container.resolve<UserService>('UserService')
    expect(userService.getUser()).toBe('result')
  })

  it('should throw error when resolving unregistered service', () => {
    const container = new Container()

    expect(() => {
      container.resolve('UnknownService')
    }).toThrow('Service not registered: UnknownService')
  })

  it('should check if service is registered', () => {
    const container = new Container()

    container.register('TestService', () => ({}))

    expect(container.has('TestService')).toBe(true)
    expect(container.has('UnknownService')).toBe(false)
  })

  it('should create a scoped container', () => {
    const container = new Container()
    
    class TestService {
      id = Math.random()
    }

    container.registerScoped('TestService', () => new TestService())

    const scope1 = container.createScope()
    const scope2 = container.createScope()

    const instance1 = scope1.resolve<TestService>('TestService')
    const instance2 = scope2.resolve<TestService>('TestService')

    expect(instance1.id).not.toBe(instance2.id)
  })

  it('should clear all registrations', () => {
    const container = new Container()

    container.register('Service1', () => ({}))
    container.register('Service2', () => ({}))

    expect(container.has('Service1')).toBe(true)
    expect(container.has('Service2')).toBe(true)

    container.clear()

    expect(container.has('Service1')).toBe(false)
    expect(container.has('Service2')).toBe(false)
  })

  it('should use symbols as identifiers', () => {
    const container = new Container()
    const SERVICE_ID = Symbol('TestService')

    class TestService {
      value = 'test'
    }

    container.register(SERVICE_ID, () => new TestService())

    const instance = container.resolve<TestService>(SERVICE_ID)
    expect(instance.value).toBe('test')
  })

  it('should use classes as identifiers', () => {
    const container = new Container()

    class TestService {
      value = 'test'
    }

    container.registerClass(TestService, TestService)

    const instance = container.resolve<TestService>(TestService)
    expect(instance).toBeInstanceOf(TestService)
    expect(instance.value).toBe('test')
  })
})
