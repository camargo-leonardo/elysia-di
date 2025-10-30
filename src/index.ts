import { Elysia } from 'elysia'
import { Container } from './container'

import type {
    DIOptions,
    ClassRegistration,
  ServiceRegistration,
  BuildServicesObject,
  InstanceRegistration,
} from './types'

export function di<
  const Services extends readonly ServiceRegistration[],
  const Classes extends readonly ClassRegistration[],
  const Instances extends readonly InstanceRegistration[],
>(options: DIOptions<Services, Classes, Instances> = {}) {
  const {
    services = [] as unknown as Services,
    classes = [] as unknown as Classes,
    instances = [] as unknown as Instances,
    enableScoping = true,
  } = options
  const container = new Container()

  // Register services with factory functions
  for (const registration of services) {
    if ('factory' in registration) {
      const { identifier, factory, lifecycle } = registration as ServiceRegistration
      container.register(identifier, factory, lifecycle)
    }
  }

  // Register classes
  for (const registration of classes) {
    const { identifier, classConstructor, lifecycle } = registration as ClassRegistration
    container.registerClass(identifier, classConstructor, lifecycle)
  }

  // Register instances
  for (const registration of instances) {
    const { identifier, instance } = registration as InstanceRegistration
    container.registerInstance(identifier, instance)
  }

  // Combine all registrations for type inference
  type AllRegistrations = [...Services, ...Classes, ...Instances]
  type ServicesObject = BuildServicesObject<AllRegistrations>

  // Extract string identifiers from registration arrays
  const stringIdentifiers = [
    ...services.map(s => 'identifier' in s ? s.identifier : null),
    ...classes.map(c => c.identifier),
    ...instances.map(i => i.identifier),
  ].filter((id): id is string => typeof id === 'string')

  if (enableScoping) {
    const plugin = new Elysia({ name: 'elysia-di' })
      .derive({ as: 'global' }, () => {
        let scopedContainer: Container | null = null
        const servicesObj = {} as ServicesObject & { _diContainer?: Container }
        
        Object.defineProperty(servicesObj, '_diContainer', {
          get: () => scopedContainer,
          enumerable: false,
          configurable: true,
        })
        
        for (const identifier of stringIdentifiers) {
          Object.defineProperty(servicesObj, identifier, {
            get: () => {
              if (!scopedContainer) {
                scopedContainer = container.createScope()
              }
              return scopedContainer.resolve(identifier)
            },
            enumerable: true,
            configurable: true,
          })
        }

        return servicesObj as ServicesObject
      })
      .onAfterResponse((context: any) => {
        const scopedContainer = context._diContainer
        if (scopedContainer && scopedContainer instanceof Container) {
          scopedContainer.clearScope()
        }
      })
    
    return plugin
  } else {
    const servicesObj = {} as ServicesObject
    for (const identifier of stringIdentifiers) {
      Object.defineProperty(servicesObj, identifier, {
        get: () => container.resolve(identifier),
        enumerable: true,
        configurable: true,
      })
    }

    return new Elysia({ name: 'elysia-di' })
      .derive({ as: 'global' }, () => servicesObj)
  }
}

export * from './container'
export * from './types'
