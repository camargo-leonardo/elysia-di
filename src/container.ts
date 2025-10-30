export type ServiceIdentifier<T = any> = string | symbol | Class<T>

export interface Class<T> extends Function {
  new (...args: any[]): T
}

export type Factory<T> = (container: import('./container').Container) => T

export enum Lifecycle {
  Transient = 'transient',
  Singleton = 'singleton',
  Scoped = 'scoped',
}

export interface Registration<T = any> {
  factory: Factory<T>
  lifecycle: Lifecycle
  instance?: T
}


export class Container {
  private registrations: Map<ServiceIdentifier, Registration> = new Map()
  private scopedInstances: Map<ServiceIdentifier, any> = new Map()

  /**
   * Register a service with a factory function
   */
  register<T>(
    identifier: ServiceIdentifier<T>,
    factory: Factory<T>,
    lifecycle: Lifecycle = Lifecycle.Transient,
  ): void {
    this.registrations.set(identifier, {
      factory,
      lifecycle,
    })
  }

  /**
   * Register a singleton service
   */
  registerSingleton<T>(
    identifier: ServiceIdentifier<T>,
    factory: Factory<T>,
  ): void {
    this.register(identifier, factory, Lifecycle.Singleton)
  }

  /**
   * Register a transient service (new instance every time)
   */
  registerTransient<T>(
    identifier: ServiceIdentifier<T>,
    factory: Factory<T>,
  ): void {
    this.register(identifier, factory, Lifecycle.Transient)
  }

  /**
   * Register a scoped service (one instance per scope/request)
   */
  registerScoped<T>(
    identifier: ServiceIdentifier<T>,
    factory: Factory<T>,
  ): void {
    this.register(identifier, factory, Lifecycle.Scoped)
  }

  /**
   * Register a class as a service
   */
  registerClass<T>(
    identifier: ServiceIdentifier<T>,
    classConstructor: Class<T>,
    lifecycle: Lifecycle = Lifecycle.Transient,
  ): void {
    this.register(
      identifier,
      () => {
        return new classConstructor()
      },
      lifecycle,
    )
  }

  /**
   * Register an existing instance as a singleton
   */
  registerInstance<T>(identifier: ServiceIdentifier<T>, instance: T): void {
    this.registrations.set(identifier, {
      factory: () => instance,
      lifecycle: Lifecycle.Singleton,
      instance,
    })
  }

  /**
   * Resolve a service from the container
   */
  resolve<T>(identifier: ServiceIdentifier<T>): T {
    const registration = this.registrations.get(identifier)

    if (!registration) {
      throw new Error(
        `Service not registered: ${String(identifier)}`,
      )
    }

    switch (registration.lifecycle) {
      case Lifecycle.Singleton:
        if (!registration.instance) {
          registration.instance = registration.factory(this)
        }
        return registration.instance

      case Lifecycle.Scoped:
        if (!this.scopedInstances.has(identifier)) {
          this.scopedInstances.set(
            identifier,
            registration.factory(this),
          )
        }
        return this.scopedInstances.get(identifier)

      case Lifecycle.Transient:
      default:
        return registration.factory(this)
    }
  }

  /**
   * Check if a service is registered
   */
  has(identifier: ServiceIdentifier): boolean {
    return this.registrations.has(identifier)
  }

  /**
   * Create a scoped container (for per-request scenarios)
   */
  createScope(): Container {
    const scopedContainer = new Container()
    
    this.registrations.forEach((registration, identifier) => {
      if (registration.lifecycle === Lifecycle.Singleton) {
        scopedContainer.registrations.set(identifier, {
          factory: () => this.resolve(identifier),
          lifecycle: Lifecycle.Singleton,
          instance: registration.instance,
        })
      } else {
        scopedContainer.registrations.set(identifier, {
          ...registration,
          instance: undefined,
        })
      }
    })

    return scopedContainer
  }

  clearScope(): void {
    this.scopedInstances.clear()
  }

  clear(): void {
    this.registrations.clear()
    this.scopedInstances.clear()
  }
}

