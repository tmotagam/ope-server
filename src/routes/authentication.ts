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
import { body, param } from 'express-validator';

import {
  register,
  login,
  logout,
  userverification,
  review,
  verification,
  secure,
  forgotpassword,
  resetpassword,
} from '../controllers/authenticationController';

const AuthenticationRouter = Router();

AuthenticationRouter.post(
  '/login/:state',
  body('id').not().isEmpty().trim().escape().isAlphanumeric(),
  body('password')
    .not()
    .isEmpty()
    .trim()
    .custom((value) => {
      const re =
        /^(?=.*\d)(?=.*[-!@#$%^&*()_+|~=`{}\[\]:";'<>?,.\/])(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
      if (re.test(value)) {
        return true;
      } else {
        return false;
      }
    }),
  param('state').not().isEmpty().trim(),
  login
);

AuthenticationRouter.post(
  '/register',
  body('comType')
    .not()
    .isEmpty()
    .isAlpha()
    .custom((value) => {
      if (value === 'EMAIL') {
        return true;
      } else {
        return false;
      }
    }),
  body('comid')
    .if(
      body('comType').custom((value: string) => {
        if (value === 'EMAIL') {
          return true;
        } else {
          return false;
        }
      })
    )
    .not()
    .isEmpty()
    .isEmail()
    .normalizeEmail(),
  body('name').not().isEmpty().trim().escape(),
  body('type')
    .not()
    .isEmpty()
    .trim()
    .escape()
    .isAlpha()
    .custom((value: string) => {
      if (value === 'ADMIN' || value === 'EXAMINEE' || value === 'MODERATOR') {
        return true;
      } else {
        return false;
      }
    }),
  body('password')
    .if(
      body('type').custom((value: string) => {
        if (value === 'ADMIN' || value === 'MODERATOR') {
          return true;
        } else {
          return false;
        }
      })
    )
    .not()
    .isEmpty()
    .trim()
    .custom((value) => {
      const re =
        /^(?=.*\d)(?=.*[-!@#$%^&*()_+|~=`{}\[\]:";'<>?,.\/])(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
      if (re.test(value)) {
        return true;
      } else {
        return false;
      }
    }),
  body('confirmPassword')
    .if(
      body('type').custom((value: string) => {
        if (value === 'ADMIN' || value === 'MODERATOR') {
          return true;
        } else {
          return false;
        }
      })
    )
    .not()
    .isEmpty()
    .trim()
    .isLength({ min: 8 })
    .custom((value, { req }) => {
      if (value === req.body.password) {
        return true;
      } else {
        return false;
      }
    }),
  register
);

AuthenticationRouter.get(
  '/logout',
  logout
);

AuthenticationRouter.get(
  '/forgot_password/:idn',
  param('idn').not().isEmpty().trim().isAlphanumeric(),
  forgotpassword
);

AuthenticationRouter.post(
  '/reset_password/:id/:code',
  param('id').not().isEmpty().trim().isAlphanumeric(),
  param('code').not().isEmpty().trim().escape(),
  body('password')
    .not()
    .isEmpty()
    .trim()
    .custom((value) => {
      const re =
        /^(?=.*\d)(?=.*[-!@#$%^&*()_+|~=`{}\[\]:";'<>?,.\/])(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
      if (re.test(value)) {
        return true;
      } else {
        return false;
      }
    }),
  body('confirmpassword')
    .not()
    .isEmpty()
    .trim()
    .isLength({ min: 8 })
    .custom((value, { req }) => {
      if (value === req.body.password) {
        return true;
      } else {
        return false;
      }
    }),
  resetpassword
);

AuthenticationRouter.post(
  '/userverification/:id/:type',
  param('id').not().isEmpty().trim(),
  param('type')
    .not()
    .isEmpty()
    .trim()
    .isAlpha()
    .custom((value: string) => {
      if (value === 'ADMIN' || value === 'EXAMINEE' || value === 'MODERATOR') {
        return true;
      } else {
        return false;
      }
    }),
  body('code').not().isEmpty().trim().escape(),
  userverification
);

AuthenticationRouter.post(
  '/verification/:id',
  param('id').not().isEmpty().trim().isAlphanumeric(),
  body('code').not().isEmpty().trim().escape(),
  verification
);

AuthenticationRouter.post(
  '/secure/:id',
  param('id').not().isEmpty().trim().isAlphanumeric(),
  body('code').not().isEmpty().trim().escape(),
  secure
);

AuthenticationRouter.post(
  '/review/:code/:id',
  param('id').not().isEmpty().trim().isAlphanumeric(),
  param('code').not().isEmpty().trim().escape(),
  body('type').not().isEmpty().isJSON(),
  body('name')
    .if(
      body('type').custom((value: string) => {
        if (JSON.parse(value).type.includes('Problem with name')) {
          return true;
        } else {
          return false;
        }
      })
    )
    .not()
    .isEmpty()
    .trim()
    .escape(),
  review
);

export { AuthenticationRouter };
