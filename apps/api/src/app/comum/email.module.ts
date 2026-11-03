import { Module } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * Um módulo só para o envio de e-mail, importado por quem precisa dele
 * (recuperação de senha, convites): uma configuração SMTP, um transporte.
 */
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
