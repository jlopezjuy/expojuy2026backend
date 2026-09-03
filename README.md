# expoJujuy

This application was generated using JHipster 9.2.0, you can find documentation and help at [https://www.jhipster.tech/documentation-archive/v9.2.0](https://www.jhipster.tech/documentation-archive/v9.2.0).

This application was generated using the [NodeJS blueprint](https://github.com/jhipster/generator-jhipster-nodejs) of JHipster 9.2.0, you can find documentation and help at [https://www.jhipster.tech/documentation-archive/v9.2.0](https://www.jhipster.tech/documentation-archive/v9.2.0). For any questions you can refer to the stream lead: [Angelo Manganiello](https://github.com/amanganiello90).

## Project Structure

Node is required for generation and recommended for development. `package.json` is always generated for a better development experience with prettier, commit hooks, scripts and so on.

In the project root, JHipster generates configuration files for tools like git, prettier, husky, and others that are well known and you can find references in the web.

- `.yo-rc.json` - Yeoman configuration file
  JHipster configuration is stored in this file at `generator-jhipster` key. You may find `generator-jhipster-*` for specific blueprints configuration.
- `.yo-resolve` (optional) - Yeoman conflict resolver
  Allows to use a specific action when conflicts are found skipping prompts for files that matches a pattern. Each line should match `[pattern] [action]` with pattern been a [Minimatch](https://github.com/isaacs/minimatch#minimatch) pattern and action been one of skip (default if ommited) or force. Lines starting with `#` are considered comments and are ignored.
- `.jhipster/*.json` - JHipster entity configuration files
- `/docker/` - Docker configurations for the application and services that the application depends on
- `/client/` - Web application.
- `/server/` - NodeJS server application.

## Development

### JWT authentication and authorization

Congratulations! You've selected an excellent way to secure your NHipster application. If you're not sure what JSON Web Token (JWT) is, please see [What the Heck is JWT?](https://jwt.io/introduction/)

Your app uses, to get and use the token, the `server//src/config/application.yml` settings:

```yaml
  ...
  security:
    authentication:
        jwt:
            # This token must be encoded using Base64 and be at least 256 bits long (you can type `openssl rand -base64 64` on your command line to generate a 512 bits one)
            base64-secret: {yourSecret}
            # Token is valid 24 hours
            token-validity-in-seconds: 86400
            token-validity-in-seconds-for-remember-me: 2592000
```

You can use the default secret created from the app, or change it.
So to get a token, you have to pass a POST request on the _api/authenticate_ url with **UserLoginDTO** as body.
For this you can use **swagger ui** on **/api/v2/api-docs** path, or the client login page (if you have generated it).

### Using NestJS CLI

You can also use [NestJS CLI][] to generate some custom server code.

For example, the following command:

    nest generate module my-module

will generate the file:

    create server//src/my-component/my-component.module.ts

### Building and running

#### Running

```bash
npm run start:app
```

#### Building

```bash
npm run build:app
```

The build folder with all compiled sources will be **server//dist**.

> For more explanation about full stack server/client build refer to [server//README.md](server//README.md)

## Building for production

## Testing

## Others

### Code quality using Sonar

Sonar is used to analyse code quality. You can start a local Sonar server (accessible on http://localhost:9001) with:

```
docker compose -f src/main/docker/sonar.yml up -d
```

Note: we have turned off forced authentication redirect for UI in [src/main/docker/sonar.yml](src/main/docker/sonar.yml) for out of the box experience while trying out SonarQube, for real use cases turn it back on.

You can run a Sonar analysis with using the [sonar-scanner](https://docs.sonarqube.org/display/SCAN/Analyzing+with+SonarQube+Scanner).
Then, run a Sonar analysis in the server/ folder:

```sh
npm run sonar:scanner
```

For more information, refer to the [Code quality page][].

## References

- [JHipster Homepage and latest documentation](https://www.jhipster.tech/)
- [JHipster 9.2.0 archive](https://www.jhipster.tech/documentation-archive/v9.2.0)
- [Using JHipster in development](https://www.jhipster.tech/documentation-archive/v9.2.0/development/)
- [Using Docker and Docker-Compose](https://www.jhipster.tech/documentation-archive/v9.2.0/docker-compose)
- [Using JHipster in production](https://www.jhipster.tech/documentation-archive/v9.2.0/production/)
- [Running tests page](https://www.jhipster.tech/documentation-archive/v9.2.0/running-tests/)
- [Code quality page](https://www.jhipster.tech/documentation-archive/v9.2.0/code-quality/)
- [Setting up Continuous Integration](https://www.jhipster.tech/documentation-archive/v9.2.0/setting-up-ci/)
- [Node.js](https://nodejs.org/)
- [NPM](https://www.npmjs.com/)
  [Node.js]: https://nodejs.org/
  [Webpack]: https://webpack.github.io/
  [Jest]: https://facebook.github.io/jest/
  [NestJS]: https://nestjs.com/
  [NestJS CLI]: https://docs.nestjs.com/cli/usages
