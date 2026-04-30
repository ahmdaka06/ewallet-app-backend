export type JwtUser = {
    sub: string;
    email: string;
    name: string;
};

export type JwtPayload = {
    sub: string;
    email: string;
};

export type AccessTokenPayload = {
  sub: string;
  email: string;
};

export type RefreshTokenPayload = {
  sub: string;
  email: string;
  jti: string;
};

