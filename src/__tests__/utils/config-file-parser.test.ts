/**
 * Tests for the config file parser module.
 * Tests parsing of multiline local_path:remote_path mappings.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseConfigFiles } from '../../utils/config-file-parser';

describe('parseConfigFiles', () => {
    const tempDir = '/tmp/config-file-parser-test';
    const tempFile1 = path.join(tempDir, 'app.conf');
    const tempFile2 = path.join(tempDir, 'traefik.yml');

    beforeAll(() => {
        fs.mkdirSync(tempDir, { recursive: true });
        fs.writeFileSync(tempFile1, 'server { listen 80; }');
        fs.writeFileSync(tempFile2, 'entryPoints:\n  web:\n    address: ":80"');
    });

    afterAll(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return empty array for empty input', () => {
        expect(parseConfigFiles('')).toEqual([]);
        expect(parseConfigFiles('   ')).toEqual([]);
    });

    it('should return empty array for null/undefined input', () => {
        expect(parseConfigFiles(null as unknown as string)).toEqual([]);
        expect(parseConfigFiles(undefined as unknown as string)).toEqual([]);
    });

    it('should parse a single config file mapping', () => {
        const result = parseConfigFiles(`${tempFile1}:app.conf`);

        expect(result).toHaveLength(1);
        expect(result[0].localPath).toBe(tempFile1);
        expect(result[0].remotePath).toBe('app.conf');
        expect(result[0].content).toBe('server { listen 80; }');
    });

    it('should parse multiple config file mappings', () => {
        const input = `${tempFile1}:app.conf\n${tempFile2}:traefik.yml`;
        const result = parseConfigFiles(input);

        expect(result).toHaveLength(2);
        expect(result[0].remotePath).toBe('app.conf');
        expect(result[1].remotePath).toBe('traefik.yml');
    });

    it('should skip blank lines and comments', () => {
        const input = [
            '# This is a comment',
            '',
            `${tempFile1}:app.conf`,
            '   ',
            '# Another comment',
            `${tempFile2}:traefik.yml`,
        ].join('\n');

        const result = parseConfigFiles(input);
        expect(result).toHaveLength(2);
    });

    it('should support nested remote paths', () => {
        const result = parseConfigFiles(`${tempFile1}:configs/nested/app.conf`);

        expect(result).toHaveLength(1);
        expect(result[0].remotePath).toBe('configs/nested/app.conf');
    });

    it('should throw on missing colon separator', () => {
        expect(() => parseConfigFiles('just-a-path-no-colon')).toThrow(
            'Malformed config file mapping on line 1'
        );
    });

    it('should throw on empty local path', () => {
        expect(() => parseConfigFiles(':remote.conf')).toThrow(
            'Empty local path on line 1'
        );
    });

    it('should throw on empty remote path', () => {
        expect(() => parseConfigFiles(`${tempFile1}:`)).toThrow(
            'Empty remote path on line 1'
        );
    });

    it('should throw on absolute remote path', () => {
        expect(() => parseConfigFiles(`${tempFile1}:/etc/app.conf`)).toThrow(
            'Absolute remote path on line 1'
        );
    });

    it('should throw on duplicate remote paths', () => {
        const input = `${tempFile1}:app.conf\n${tempFile2}:app.conf`;
        expect(() => parseConfigFiles(input)).toThrow(
            'Duplicate remote path on line 2'
        );
    });

    it('should throw when local file does not exist', () => {
        expect(() => parseConfigFiles('/nonexistent/file.conf:remote.conf')).toThrow(
            'Config file not found on line 1'
        );
    });

    it('should throw when local path is a directory', () => {
        expect(() => parseConfigFiles(`${tempDir}:remote-dir`)).toThrow(
            'Config path is not a file on line 1'
        );
    });

    it('should trim whitespace from paths', () => {
        const result = parseConfigFiles(`  ${tempFile1}  :  app.conf  `);

        expect(result).toHaveLength(1);
        expect(result[0].remotePath).toBe('app.conf');
    });
});
