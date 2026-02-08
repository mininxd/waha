import {
  Body,
  Controller,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { WAHAValidationPipe } from '@waha/nestjs/pipes/WAHAValidationPipe';
import { SessionManager } from '../../core/abc/manager.abc';
import { SendButtonsRequest } from '@waha/structures/chatting.buttons.dto';
import { SendListRequest } from '@waha/structures/chatting.list.dto';
import {
  MessageButtonReply,
  MessagePollRequest,
  MessagePollVoteRequest,
} from '../../structures/chatting.dto';
import { PoliciesGuard } from '@waha/core/auth/policies.guard';
import { CheckPolicies } from '@waha/core/auth/policies.decorator';
import { CanSession, FromBody } from '@waha/core/auth/policies';
import { Action } from '@waha/core/auth/casl.types';

@ApiSecurity('api_key')
@Controller('api')
@ApiTags('📤 Chatting')
@UseGuards(PoliciesGuard)
export class InteractiveController {
  constructor(private manager: SessionManager) {}

  @Post('/sendButtons')
  @ApiOperation({
    summary: 'Send buttons message (interactive)',
    description: 'Send Buttons',
    deprecated: true,
  })
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  @UsePipes(new WAHAValidationPipe())
  async sendButtons(@Body() request: SendButtonsRequest) {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    return whatsapp.sendButtons(request);
  }

  @Post('/sendList')
  @ApiOperation({
    summary: 'Send a list message (interactive)',
    description: 'Send a List message with sections and rows',
  })
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  @UsePipes(new WAHAValidationPipe())
  async sendList(@Body() request: SendListRequest) {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    return whatsapp.sendList(request);
  }

  @Post('/sendPoll')
  @ApiOperation({
    summary: 'Send a poll with options',
    description: 'You can use it as buttons or list replacement',
  })
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  async sendPoll(@Body() request: MessagePollRequest) {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    return whatsapp.sendPoll(request);
  }

  @Post('/sendPollVote')
  @ApiOperation({
    summary: 'Vote on a poll',
    description: 'Cast vote(s) on an existing poll message',
  })
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  @UsePipes(new WAHAValidationPipe())
  async sendPollVote(@Body() request: MessagePollVoteRequest) {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    return whatsapp.sendPollVote(request);
  }

  @Post('/send/buttons/reply')
  @ApiOperation({
    summary: 'Reply on a button message',
  })
  @CheckPolicies(CanSession(Action.Use, FromBody('session')))
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async sendButtonsReply(@Body() request: MessageButtonReply) {
    const whatsapp = await this.manager.getWorkingSession(request.session);
    return whatsapp.sendButtonsReply(request);
  }
}
