require('dotenv').config({ path: '.env' });
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cloudConfigClient from 'cloud-config-client';

import { AppModule } from './app.module';
import { config } from './config';
import { setupSwagger } from './swagger';
const logger: Logger = new Logger('Main');
const port = process.env.NODE_SERVER_PORT || config.get('server.port');
const useJHipsterRegistry = config.get('eureka.client.enabled');

async function bootstrap(): Promise<void> {
  loadCloudConfig();
  registerAsEurekaService();

  const appOptions = { cors: true };
  const app = await NestFactory.create(AppModule, appOptions);
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: (): BadRequestException => new BadRequestException('Validation error'),
      // https://github.com/nestjs/nest/issues/10683#issuecomment-1349614194
      forbidUnknownValues: false,
    }),
  );
  // Disable cache.
  app.getHttpAdapter().getInstance().set('etag', false);

  logger.log(`The client is not been generated`);
  setupSwagger(app);

  await app.listen(port);
  logger.log(`Application listening on port ${port}`);
}

async function loadCloudConfig(): Promise<void> {
  if (useJHipsterRegistry) {
    const endpoint = config.get('cloud.config.uri') || 'http://admin:admin@localhost:8761/config';
    logger.log(`Loading cloud config from ${endpoint}`);

    const cloudConfig = await cloudConfigClient.load({
      context: process.env,
      endpoint,
      name: config.get('cloud.config.name'),
      profiles: config.get('cloud.config.profile') || ['prod'],
      // auth: {
      //   user: config.get('jhipster.registry.username') || 'admin',
      //   pass: config.get('jhipster.registry.password') || 'admin'
      // }
    });
    config.addAll(cloudConfig.properties);
  }
}

function registerAsEurekaService(): void {
  if (useJHipsterRegistry) {
    logger.log(`Registering with eureka ${config.get('cloud.config.uri')}`);
    const { Eureka } = require('eureka-js-client');
    const eurekaUrl = require('url').parse(config.get('cloud.config.uri'));
    const client = new Eureka({
      instance: {
        app: config.get('eureka.instance.appname'),
        instanceId: config.get('eureka.instance.instanceId'),
        hostName: config.get('ipAddress') || 'localhost',
        ipAddr: config.get('ipAddress') || '127.0.0.1',
        status: `UP`,
        port: {
          $: port,
          '@enabled': 'true',
        },
        vipAddress: config.get('ipAddress') || 'localhost',
        homePageUrl: `http://${config.get('ipAddress')}:${port}/`,
        dataCenterInfo: {
          '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
          name: 'MyOwn',
        },
      },
      eureka: {
        // eureka server host / port
        host: eurekaUrl.hostname || '127.0.0.1',
        port: eurekaUrl.port || 8761,
        servicePath: '/eureka/apps',
      },
      requestMiddleware: (requestOpts, done): any => {
        requestOpts.auth = {
          user: config.get('jhipster.registry.username') || 'admin',
          password: config.get('jhipster.registry.password') || 'admin',
        };
        done(requestOpts);
      },
    });
    client.logger.level('debug');
    client.start(error => logger.log(error || 'Eureka registration complete'));
  }
}

bootstrap();
