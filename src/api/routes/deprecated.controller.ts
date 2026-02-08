import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { SessionManager } from '../../core/abc/manager.abc';
import {
  CheckNumberStatusQuery,
  GetMessageQuery,
  MessageLinkPreviewRequest,
  MessageReplyRequest,
  MessageTextQuery,
  MessageTextRequest,
  WANumberExistResult,
} from '../../structures/chatting.dto';
import { GetChatMessagesFilter, transformAck } from '@waha/structures/chats.dto';
import { PoliciesGuard } from '@waha/core/auth/policies.guard';
import { CheckPolicies } from '@waha/core/auth/policies.decorator';
import { CanSession, FromBody, FromQuery } from '@waha/core/auth/policies';
import { Action } from '@waha/core/auth/casl.types';

@ApiSecurity('api_key')
@Controller('api')
@ApiTags('📤 Chatting')
@UseGuards(PoliciesGuard)
export class DeprecatedController {
  constructor(private manager: SessionManager) {}

  @Get('/sendText')
  @ApiOperation({ summary: 'Send a text message', deprecated: true })
  @CheckPolicies(CanSession(Action.Use, FromQuery('session')))
  async sendTextGet(@Query() query: MessageTextQuery) {
    const whatsapp = await this.manager.getWorkingSession(query.session);
    const msg = new MessageTextRequest();
    msg.chatId = query.phone;
    msg.text = query.text;
    return whatsapp.sendText(msg);
  }

  @Get('/messages')
  @ApiOperation({
    summary: 'Get messages in a chat',
    description: 'DEPRECATED. Use "GET /api/chats/{id}/messages" instead',
    deprecated: true,
  })
  @CheckPolicies(CanSession(Action.Use, FromQuery('session')))
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getMessages(
    @Query() query: GetMessageQuery,
    @Query() filter: GetChatMessagesFilter,
  ) {
    filter = transformAck(filter);
    const whatsapp = await this.manager.getWorkingSession(query.session);
    return whatsapp.getChatMessages(query.chatId, query, filter);
  }

  @Get('/checkNumberStatus')
  @ApiOperation({
    summary: 'Check number status',
    description: 'DEPRECATED. Use "POST /contacts/check-exists" instead',
    deprecated: true,
  })
  @CheckPolicies(CanSession(Action.Use, FromQuery('session')))
  async DEPRECATED_checkNumberStatus(
    @Query() request: CheckNumberStatusQuery,
  ): Promise<WANumberExistResult> {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    return whatsapp.checkNumberStatus(request);
  }

  @Post('/reply')
  @ApiOperation({
    summary:
      'DEPRECATED - you can set "reply_to" field when sending text, image, etc',
    deprecated: true,
  })
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  async reply(@Body() request: MessageReplyRequest) {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    return whatsapp.reply(request);
  }

  @Post('/sendLinkPreview')
  @ApiOperation({ deprecated: true })
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  async sendLinkPreview_DEPRECATED(@Body() request: MessageLinkPreviewRequest) {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    return whatsapp.sendLinkPreview(request);
  }
}
