/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { LoggingInterceptor } from '../../client/interceptors/logging.interceptor';
import { AuthGuard, RoleType, Roles, RolesGuard } from '../../security';
import { AuthService } from '../../service/auth.service';
import { PasswordChangeDTO } from '../../service/dto/password-change.dto';
import { UserDTO } from '../../service/dto/user.dto';

@Controller('api')
@UseInterceptors(LoggingInterceptor, ClassSerializerInterceptor)
@ApiTags('account-resource')
export class AccountController {
  logger = new Logger('AccountController');

  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  @ApiOperation({ summary: 'Register user' })
  @ApiResponse({
    status: 201,
    description: 'Registered user',
    type: UserDTO,
  })
  async registerAccount(@Req() req: { user: UserDTO }, @Body() userDTO: UserDTO & { password: string }): Promise<any> {
    return await this.authService.registerNewUser(userDTO);
  }

  @Get('/activate')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Activate an account' })
  @ApiResponse({
    status: 200,
    description: 'activated',
  })
  activateAccount(@Param() key: string, @Res() res: Response): any {
    throw new InternalServerErrorException();
  }

  @Get('/authenticate')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Check if the user is authenticated' })
  @ApiResponse({
    status: 200,
    description: 'login authenticated',
  })
  isAuthenticated(@Req() req: { user: UserDTO }): any {
    const { user } = req;
    return user.login;
  }

  @Get('/account')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get the current user.' })
  @ApiResponse({
    status: 200,
    description: 'user retrieved',
  })
  async getAccount(@Req() req: { user: UserDTO }): Promise<any> {
    const { user } = req;
    const userProfileFound = await this.authService.getAccount(user.id);
    return userProfileFound;
  }

  @Post('/account')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update the current user information' })
  @ApiResponse({
    status: 200,
    description: 'user info updated',
    type: UserDTO,
  })
  async saveAccount(@Req() req: { user: UserDTO }, @Body() newUserInfo: UserDTO): Promise<any> {
    const { user } = req;
    return await this.authService.updateUserSettings(user.login, newUserInfo);
  }

  @Post('/account/change-password')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Change current password' })
  @ApiResponse({
    status: 200,
    description: 'user password changed',
    type: PasswordChangeDTO,
  })
  async changePassword(@Req() req: { user: UserDTO }, @Body() passwordChange: PasswordChangeDTO): Promise<any> {
    const { user } = req;
    return await this.authService.changePassword(user.login, passwordChange.currentPassword, passwordChange.newPassword);
  }

  @Post('/account/reset-password/init')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Send an email to reset the password of the user' })
  @ApiResponse({
    status: 201,
    description: 'mail to reset password sent',
    type: 'string',
  })
  requestPasswordReset(@Req() req: { user: UserDTO }, @Body() email: string, @Res() res: Response): any {
    throw new InternalServerErrorException();
  }

  @Post('/account/reset-password/finish')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Finish to reset the password of the user' })
  @ApiResponse({
    status: 201,
    description: 'password reset',
    type: 'string',
  })
  finishPasswordReset(@Req() req: { user: UserDTO }, @Body() keyAndPassword: string, @Res() res: Response): any {
    throw new InternalServerErrorException();
  }
}
