import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../domain/user.entity';
import { UserService } from '../service/user.service';
import { ManagementController } from '../web/rest/management.controller';
import { UserController } from '../web/rest/user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController, ManagementController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
