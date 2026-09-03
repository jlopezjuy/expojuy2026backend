import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { config } from '../config';
import { Authority } from '../domain/authority.entity';
import { UserModule } from '../module/user.module';
import { JwtStrategy } from '../security/passport.jwt.strategy';
import { AuthService } from '../service/auth.service';
import { AccountController } from '../web/rest/account.controller';
import { PublicUserController } from '../web/rest/public.user.controller';
import { UserJWTController } from '../web/rest/user.jwt.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Authority]),
    UserModule,
    PassportModule,
    JwtModule.register({
      secret: config['jhipster.security.authentication.jwt.base64-secret'],
      signOptions: { expiresIn: '300s' },
    }),
  ],
  controllers: [UserJWTController, PublicUserController, AccountController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
