import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AppConfigService } from '../../../shared/config/config.service';
import { AuthRepository } from '../auth.repository';
import { JwtPayload, JwtUser } from '../../../common/types/jwt.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        private readonly config: AppConfigService,
        private readonly authRepository: AuthRepository
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: config.jwtAccessSecret,
        });
    }

    async validate(payload: JwtPayload): Promise<JwtUser> {

        const user = await this.authRepository.findUserById(payload.sub);

        if (!user) {
            throw new UnauthorizedException('Invalid access token');
        }

        return {
            sub: user.id,
            email: user.email,
            name: user.name,
        }
    }
}