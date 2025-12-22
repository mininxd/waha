import {
  NotImplementedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getEngineName } from '@waha/config';

export const DOCS_URL = 'https://waha.devlike.pro/';
export const ISSUES_URL = 'https://github.com/mininxd/waha/issues';

const engine = getEngineName();

export class NotImplementedByEngineError extends NotImplementedException {
  constructor(msg = '') {
    let error = `The method is not implemented by the '${engine}' engine. Request this feature at ${ISSUES_URL}`;
    if (msg) {
      error = `${msg} ${error}`;
    }
    super(error);
  }
}

export class AvailableInPlusVersion extends UnprocessableEntityException {
  constructor(feature: string = 'The feature') {
    super(
      `${feature} is in plus version. Request to enable it in the core version at ${ISSUES_URL}`,
    );
  }
}
