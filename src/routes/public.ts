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

import { download, logo } from '../controllers/publicController';

const PublicRouter = Router();

PublicRouter.get(
  '/download/:os/:arch',
  param('os')
    .not()
    .isEmpty()
    .trim()
    .escape()
    .isAlpha()
    .custom((value: string) => {
      if (value === 'Windows') {
        return true;
      } else {
        return false;
      }
    }),
  param('arch').not().isEmpty().trim().escape().isAlphanumeric(),
  download
);

PublicRouter.get('/logo', logo);

export { PublicRouter };
