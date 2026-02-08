import {
  Body,
  Controller,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { SessionManager } from '../../core/abc/manager.abc';
import {
  ChatRequest,
  MessageReactionRequest,
  MessageStarRequest,
  SendSeenRequest,
} from '../../structures/chatting.dto';
import { ReadChatMessagesQuery } from '@waha/structures/chats.dto';
import { PoliciesGuard } from '@waha/core/auth/policies.guard';
import { CheckPolicies } from '@waha/core/auth/policies.decorator';
import { CanSession, FromBody } from '@waha/core/auth/policies';
import { Action } from '@waha/core/auth/casl.types';

@ApiSecurity('api_key')
@Controller('api')
@ApiTags('📤 Chatting')
@UseGuards(PoliciesGuard)
export class ChatActionsController {
  constructor(private manager: SessionManager) {}

  @Post('/sendSeen')
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  async sendSeen(@Body() chat: SendSeenRequest) {
    const hasMessageId = chat.messageIds?.length > 0 || Boolean(chat.messageId);
    if (!hasMessageId) {
      const whatsapp = await this.manager.getWorkingSession(chat.session);
      const query: ReadChatMessagesQuery = {
        messages: null,
        days: 7,
      };
      return whatsapp.readChatMessages(chat.chatId, query);
    }
    const whatsapp = await this.manager.getWorkingSession(chat.session);
    return whatsapp.sendSeen(chat);
  }

  @Post('/startTyping')
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  async startTyping(@Body() chat: ChatRequest) {
    // It's infinitive action
    const whatsapp = await this.manager.getWorkingSession(chat.session);
    await whatsapp.startTyping(chat);
    return { result: true };
  }

  @Post('/stopTyping')
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  async stopTyping(@Body() chat: ChatRequest) {
    const whatsapp = await this.manager.getWorkingSession(chat.session);
    await whatsapp.stopTyping(chat);
    return { result: true };
  }

  @Put('/reaction')
  @ApiOperation({ summary: 'React to a message with an emoji' })
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  async setReaction(@Body() request: MessageReactionRequest) {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    return whatsapp.setReaction(request);
  }

  @Put('/star')
  @ApiOperation({ summary: 'Star or unstar a message' })
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  async setStar(@Body() request: MessageStarRequest) {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    await whatsapp.setStar(request);
    return;
  }
}
