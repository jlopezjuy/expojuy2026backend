import { ClassSerializerInterceptor, Controller, Get, Logger, Req, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { HeaderUtil } from '../../client/header-util';
import { LoggingInterceptor } from '../../client/interceptors/logging.interceptor';
import { Page, PageRequest } from '../../domain/base/pagination.entity';
import { AuthService } from '../../service/auth.service';
import { UserDTO } from '../../service/dto/user.dto';

@Controller('api')
@UseInterceptors(LoggingInterceptor, ClassSerializerInterceptor)
@ApiTags('public-user-controller')
export class PublicUserController {
  logger = new Logger('PublicUserController');

  constructor(private readonly authService: AuthService) {}

  @Get('/users')
  @ApiOperation({ summary: 'Get the list of users' })
  @ApiResponse({
    status: 200,
    description: 'List all users records',
    type: UserDTO,
  })
  async getAllPublicUsers(@Req() req: Request): Promise<UserDTO[]> {
    const pageRequest: PageRequest = new PageRequest(req.query.page, req.query.size, req.query.sort ?? 'id,ASC');
    const [results, count] = await this.authService.getAllUsers({
      skip: +pageRequest.page * pageRequest.size,
      take: +pageRequest.size,
      order: pageRequest.sort.asOrder(),
    });
    HeaderUtil.addPaginationHeaders(req.res, new Page(results, count, pageRequest));
    return results;
  }

  @Get('/authorities')
  @ApiOperation({ summary: 'Get the list of user roles' })
  @ApiResponse({
    status: 200,
    description: 'List all user roles',
    type: 'string',
    isArray: true,
  })
  getAuthorities(@Req() req: any): any {
    const { user } = req;
    if (!user) {
      return [];
    }
    return user.authorities;
  }
}
