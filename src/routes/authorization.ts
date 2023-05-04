// OPE Server
// Copyright (C) 2020-2023  Motagamwala Taha Arif Ali

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
import { Router } from 'express';
import { param } from 'express-validator';

import {
  authorize,
  refreshToken,
  token,
} from '../controllers/authorizationController';

const AuthorizationRouter = Router();

AuthorizationRouter.get(
  '/authorize/:userid/:transformation_method/:code_challenge/:state',
  param('userid').not().isEmpty().trim().escape().isAlphanumeric(),
  param('transformation_method')
    .not()
    .isEmpty()
    .trim()
    .escape()
    .custom((value: string) => {
      if (value === 'S256') {
        return true;
      } else {
        return false;
      }
    }),
  param('code_challenge').not().isEmpty().trim(),
  param('state').not().isEmpty().trim(),
  authorize
);

AuthorizationRouter.get(
  '/token/:userid/:code_verifier/:secret_code/:state',
  param('userid').not().isEmpty().trim().escape().isAlphanumeric(),
  param('code_verifier').not().isEmpty(),
  param('secret_code').not().isEmpty().trim(),
  param('state').not().isEmpty().trim(),
  token
);

AuthorizationRouter.get(
  '/refresh_token',
  refreshToken
);

export { AuthorizationRouter };
