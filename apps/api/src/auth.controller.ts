import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto, RegisterDto } from "./dto";

@Controller("api/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post("login")
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Get("me")
  me(@Headers("authorization") authorization?: string) {
    return this.authService.getCurrentUser(authorization);
  }
}
