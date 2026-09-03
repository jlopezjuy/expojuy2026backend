import { Body, Controller, HttpCode, Logger, Post, Req, Res, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { LoggingInterceptor } from '../../client/interceptors/logging.interceptor';
import { AuthService } from '../../service/auth.service';
import { UserLoginDTO } from '../../service/dto/user-login.dto';

@Controller('api')
@UseInterceptors(LoggingInterceptor)
@ApiTags('user-jwt-controller')
export class UserJWTController {
  logger = new Logger('UserJWTController');

  constructor(private readonly authService: AuthService) {}

  @Post('/authenticate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authorization api retrieving token' })
  @ApiResponse({
    status: 200,
    description: 'Authorized',
  })
  async authorize(@Req() req: Request, @Body() user: UserLoginDTO, @Res() res: Response): Promise<any> {
    const jwt = await this.authService.login(user);
    res.setHeader('Authorization', `Bearer ${jwt.id_token}`);
    return res.json(jwt);
  }
}
