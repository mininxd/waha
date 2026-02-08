import {
  Body,
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { WAHAFileInterceptor } from '@waha/nestjs/WAHAFileInterceptor';
import { WAHAValidationPipe } from '@waha/nestjs/pipes/WAHAValidationPipe';
import { SessionManager } from '../../core/abc/manager.abc';
import {
  MessageContactVcardRequest,
  MessageFileRequest,
  MessageForwardRequest,
  MessageImageRequest,
  MessageLinkCustomPreviewRequest,
  MessageLocationRequest,
  MessageTextRequest,
  MessageVideoRequest,
  MessageVoiceRequest,
} from '../../structures/chatting.dto';
import { WAMessage } from '../../structures/responses.dto';
import {
  mentionsAll,
  validateRequestMentions,
} from '@waha/core/utils/mentions.all';
import { PoliciesGuard } from '@waha/core/auth/policies.guard';
import { CheckPolicies } from '@waha/core/auth/policies.decorator';
import {
  CanSession,
  FromBody,
  FromBodyOrQuery,
} from '@waha/core/auth/policies';
import { Action } from '@waha/core/auth/casl.types';

@ApiSecurity('api_key')
@Controller('api')
@ApiTags('📤 Chatting')
@UseGuards(PoliciesGuard)
export class SendMessagesController {
  constructor(private manager: SessionManager) {}

  @Post('/sendText')
  @ApiOperation({ summary: 'Send a text message' })
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  async sendText(@Body() request: MessageTextRequest): Promise<WAMessage> {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    if (mentionsAll(request)) {
      validateRequestMentions(request);
      request.mentions = await whatsapp.resolveMentionsAll(request.chatId);
    }
    return whatsapp.sendText(request);
  }

  @Post('/sendImage')
  @ApiOperation({
    summary: 'Send an image',
    description:
      'Either from an URL or base64 data - look at the request schemas for details.',
  })
  @CheckPolicies(CanSession(Action.Use, FromBodyOrQuery('session')))
  @UseInterceptors(WAHAFileInterceptor())
  async sendImage(@Body() request: MessageImageRequest) {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    if (mentionsAll(request)) {
      validateRequestMentions(request);
      request.mentions = await whatsapp.resolveMentionsAll(request.chatId);
    }
    return whatsapp.sendImage(request);
  }

  @Post('/sendFile')
  @ApiOperation({
    summary: 'Send a file',
    description:
      'Either from an URL or base64 data - look at the request schemas for details.',
  })
  @CheckPolicies(CanSession(Action.Use, FromBodyOrQuery('session')))
  @UseInterceptors(WAHAFileInterceptor())
  async sendFile(@Body() request: MessageFileRequest) {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    if (mentionsAll(request)) {
      validateRequestMentions(request);
      request.mentions = await whatsapp.resolveMentionsAll(request.chatId);
    }
    return whatsapp.sendFile(request);
  }

  @Post('/sendVoice')
  @ApiOperation({
    summary: 'Send an voice message',
    description:
      'Either from an URL or base64 data - look at the request schemas for details.',
  })
  @CheckPolicies(CanSession(Action.Use, FromBodyOrQuery('session')))
  @UseInterceptors(WAHAFileInterceptor())
  async sendVoice(@Body() request: MessageVoiceRequest) {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    return whatsapp.sendVoice(request);
  }

  @Post('/sendVideo')
  @ApiOperation({
    summary: 'Send a video',
    description:
      'Either from an URL or base64 data - look at the request schemas for details.',
  })
  @CheckPolicies(CanSession(Action.Use, FromBodyOrQuery('session')))
  @UseInterceptors(WAHAFileInterceptor())
  async sendVideo(@Body() request: MessageVideoRequest) {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    if (mentionsAll(request)) {
      validateRequestMentions(request);
      request.mentions = await whatsapp.resolveMentionsAll(request.chatId);
    }
    return whatsapp.sendVideo(request);
  }

  @Post('/send/link-custom-preview')
  @ApiOperation({
    summary: 'Send a text message with a CUSTOM link preview.',
    description:
      'You can use regular /api/sendText if you wanna send auto-generated link preview.',
  })
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  @UsePipes(new WAHAValidationPipe())
  async sendLinkCustomPreview(
    @Body() request: MessageLinkCustomPreviewRequest,
  ): Promise<any> {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    if (!request.text.includes(request.preview.url)) {
      throw new Error(
        '"text" must include the URL provided in the "preview.url"',
      );
    }
    return whatsapp.sendLinkCustomPreview(request);
  }

  @Post('/forwardMessage')
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  async forwardMessage(
    @Body() request: MessageForwardRequest,
  ): Promise<WAMessage> {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    return await whatsapp.forwardMessage(request);
  }

  @Post('/sendLocation')
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  async sendLocation(@Body() request: MessageLocationRequest) {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    return whatsapp.sendLocation(request);
  }

  @Post('/sendContactVcard')
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  async sendContactVcard(@Body() request: MessageContactVcardRequest) {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    return whatsapp.sendContactVCard(request);
  }
}
