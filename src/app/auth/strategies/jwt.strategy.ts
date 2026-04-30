import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AppConfigService } from '../../../shared/config/config.service';
import { AuthRepository } from '../auth.repository';
import { JwtUser } from '../../../common/types/jwt-user.type';