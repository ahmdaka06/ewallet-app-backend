import { UserResponse } from "./user.type";

export type AuthTokenResponse = {
    user: UserResponse;
    accessToken: string;
    refreshToken: string;
}

export type AuthMeResponse = {
    user: UserResponse;
}