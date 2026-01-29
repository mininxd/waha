import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { ConvertApiProperty } from '@waha/structures/properties.dto';

import {
  BinaryFile,
  RemoteFile,
  VideoBinaryFile,
  VideoRemoteFile,
  VoiceBinaryFile,
  VoiceRemoteFile,
} from './files.dto';

export const BROADCAST_ID = 'status@broadcast';

const ContactsProperty = ApiProperty({
  description: 'Contact list to send the status to.',
  example: null,
  required: false,
});

export class StatusRequest {
  @ApiProperty({
    description: 'Pre-generated status message id',
    example: 'BBBBBBBBBBBBBBBBB',
    default: null,
    required: false,
  })
  id?: string;

  @ContactsProperty
  contacts?: string[];
}

export class TextStatus extends StatusRequest {
  text: string = 'Have a look! https://github.com/';
  backgroundColor: string = '#38b42f';
  font: number = 0;

  linkPreview?: boolean = true;
  linkPreviewHighQuality?: boolean = false;
}

@ApiExtraModels(RemoteFile, BinaryFile)
export class ImageStatus extends StatusRequest {
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(RemoteFile) },
      { $ref: getSchemaPath(BinaryFile) },
    ],
  })
  file: RemoteFile | BinaryFile;

  caption?: string;
}

@ApiExtraModels(VoiceRemoteFile, VoiceBinaryFile)
export class VoiceStatus extends StatusRequest {
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(VoiceRemoteFile) },
      { $ref: getSchemaPath(VoiceBinaryFile) },
    ],
  })
  file: VoiceRemoteFile | VoiceBinaryFile;

  backgroundColor: string = '#38b42f';

  @ConvertApiProperty()
  convert: boolean;
}

@ApiExtraModels(VideoRemoteFile, VideoBinaryFile)
export class VideoStatus extends StatusRequest {
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(VideoRemoteFile) },
      { $ref: getSchemaPath(VideoBinaryFile) },
    ],
  })
  file: VideoRemoteFile | VideoBinaryFile;

  caption?: string;

  @ConvertApiProperty()
  convert: boolean;
}

export class DeleteStatusRequest extends StatusRequest {
  @ApiProperty({
    description: 'Status message id to delete',
    example: 'AAAAAAAAAAAAAAAAA',
  })
  id: string;

  @ContactsProperty
  contacts?: string[];
}
