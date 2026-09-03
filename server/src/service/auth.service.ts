import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';

import { Authority } from '../domain/authority.entity';
import { comparePassword } from '../security/password-util';
import { Payload } from '../security/payload.interface';
import { UserLoginDTO } from '../service/dto/user-login.dto';
import { UserService } from '../service/user.service';

import { UserDTO } from './dto/user.dto';

@Injectable()
export class AuthService {
  logger = new Logger('AuthService');
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Authority) private authorityRepository: Repository<Authority>,
    private userService: UserService,
  ) {}

  async login(userLogin: UserLoginDTO): Promise<any> {
    const loginUserName = userLogin.username;
    const loginPassword = userLogin.password;
    if (!loginUserName || !loginPassword) {
      throw new HttpException('Username and password are required!', HttpStatus.BAD_REQUEST);
    }

    const userFind = await this.userService.findByFields({ where: { login: loginUserName } });
    const validPassword = !!userFind && comparePassword(loginPassword, userFind.password);
    if (!userFind || !validPassword) {
      throw new HttpException('Invalid login name or password!', HttpStatus.UNAUTHORIZED);
    }

    if (userFind && !userFind.activated) {
      throw new HttpException('Your account is not been activated!', HttpStatus.UNAUTHORIZED);
    }

    const user = await this.findUserWithAuthById(userFind.id);

    const payload: Payload = { id: user.id, username: user.login, authorities: user.authorities };

    /* eslint-disable */
    return {
      id_token: this.jwtService.sign(payload),
    };
  }

  /* eslint-enable */
  async validateUser(payload: Payload): Promise<UserDTO | undefined> {
    return await this.findUserWithAuthById(payload.id);
  }

  async findUserWithAuthById(userId: number): Promise<UserDTO | undefined> {
    const userDTO: UserDTO = await this.userService.findByFields({ where: { id: userId } });
    return userDTO;
  }

  async getAccount(userId: number): Promise<UserDTO | undefined> {
    const userDTO: UserDTO = await this.findUserWithAuthById(userId);
    if (!userDTO) {
      return;
    }
    return userDTO;
  }

  async changePassword(userLogin: string, currentClearTextPassword: string, newPassword: string): Promise<void> {
    const userFind: UserDTO = await this.userService.findByFields({ where: { login: userLogin } });
    if (!userFind) {
      throw new HttpException('Invalid login name!', HttpStatus.BAD_REQUEST);
    }

    if (!comparePassword(currentClearTextPassword, userFind.password)) {
      throw new HttpException('Invalid password!', HttpStatus.BAD_REQUEST);
    }
    userFind.password = newPassword;
    await this.userService.save(userFind, userLogin, true);
  }

  async registerNewUser(newUser: UserDTO): Promise<UserDTO> {
    let userFind: UserDTO = await this.userService.findByFields({ where: { login: newUser.login } });
    if (userFind) {
      throw new HttpException('Login name already used!', HttpStatus.BAD_REQUEST);
    }
    userFind = await this.userService.findByFields({ where: { email: newUser.email } });
    if (userFind) {
      throw new HttpException('Email is already in use!', HttpStatus.BAD_REQUEST);
    }
    newUser.authorities = ['ROLE_USER'];
    const user: UserDTO = await this.userService.save(newUser, newUser.login, true);
    return user;
  }

  async updateUserSettings(userLogin: string, newUserInfo: UserDTO): Promise<UserDTO> {
    const userFind: UserDTO = await this.userService.findByFields({ where: { login: userLogin } });
    if (!userFind) {
      throw new HttpException('Invalid login name!', HttpStatus.BAD_REQUEST);
    }
    const userFindEmail: UserDTO = await this.userService.findByFields({ where: { email: newUserInfo.email } });
    if (userFindEmail && newUserInfo.email !== userFind.email) {
      throw new HttpException('Email is already in use!', HttpStatus.BAD_REQUEST);
    }

    userFind.firstName = newUserInfo.firstName;
    userFind.lastName = newUserInfo.lastName;
    userFind.email = newUserInfo.email;
    userFind.langKey = newUserInfo.langKey;
    await this.userService.save(userFind, userLogin);
    return userFind;
  }

  async getAllUsers(options: FindManyOptions<UserDTO>): Promise<[UserDTO[], number]> {
    return await this.userService.findAndCount(options);
  }
}
