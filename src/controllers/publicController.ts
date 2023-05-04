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
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { join } from 'path';

const download = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const platform = req.params.os;
    const architecture = req.params.arch;
    let packagePath = '';
    if (platform === 'Windows') {
      packagePath = join(
        __dirname,
        '..',
        'packages',
        `OPEClient-Windows-${architecture}.exe`
      );
    } else {
      throw new Error('Unrecognized Platform');
    }
    res.status(200).download(packagePath, (err) => {
      try {
        if (err) throw new Error('Cannot Send File');
      } catch (error) {
        res.status(400).json({ error: 'Request cannot be fulfilled' });
      }
    });
  } catch (error) {
    res.status(400).json({ error: 'Request cannot be fulfilled' });
  }
};

const logo = async (req: Request, res: Response) => {
  try {
    const image = join(__dirname, '..', 'templates', 'logo.png');
    res.status(200).sendFile(image, (err) => {
      try {
        if (err) throw new Error('Cannot Send File');
      } catch (error) {
        res.status(400).json({ error: 'Request cannot be fulfilled' });
      }
    });
  } catch (error) {
    res.status(400).json({ error: 'Request cannot be fulfilled' });
  }
};

export { download, logo };
