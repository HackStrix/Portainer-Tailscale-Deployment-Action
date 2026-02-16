import { parseEnvVars } from '../../utils/env-parser';

describe('parseEnvVars', () => {
    it('should parse standard KEY=VALUE pairs', () => {
        const input = 'NODE_ENV=production\nPORT=3000';
        const result = parseEnvVars(input);

        expect(result).toEqual([
            { name: 'NODE_ENV', value: 'production' },
            { name: 'PORT', value: '3000' },
        ]);
    });

    it('should handle values containing = signs', () => {
        const input = 'DATABASE_URL=postgres://user:pass@localhost:5432/db?sslmode=require';
        const result = parseEnvVars(input);

        expect(result).toEqual([
            { name: 'DATABASE_URL', value: 'postgres://user:pass@localhost:5432/db?sslmode=require' },
        ]);
    });

    it('should skip blank lines', () => {
        const input = 'A=1\n\n\nB=2';
        const result = parseEnvVars(input);

        expect(result).toEqual([
            { name: 'A', value: '1' },
            { name: 'B', value: '2' },
        ]);
    });

    it('should skip comment lines starting with #', () => {
        const input = '# This is a comment\nA=1\n# Another comment\nB=2';
        const result = parseEnvVars(input);

        expect(result).toEqual([
            { name: 'A', value: '1' },
            { name: 'B', value: '2' },
        ]);
    });

    it('should trim whitespace from keys and values', () => {
        const input = '  KEY  =  value  ';
        const result = parseEnvVars(input);

        expect(result).toEqual([{ name: 'KEY', value: 'value' }]);
    });

    it('should handle duplicate keys (last value wins)', () => {
        const input = 'A=first\nB=middle\nA=second';
        const result = parseEnvVars(input);

        expect(result).toEqual([
            { name: 'B', value: 'middle' },
            { name: 'A', value: 'second' },
        ]);
    });

    it('should return empty array for empty input', () => {
        expect(parseEnvVars('')).toEqual([]);
        expect(parseEnvVars('   ')).toEqual([]);
    });

    it('should throw on malformed lines (no = sign)', () => {
        const input = 'VALID=ok\nINVALID_LINE';

        expect(() => parseEnvVars(input)).toThrow('Malformed env var on line 2');
    });

    it('should throw on empty key', () => {
        const input = '=value';

        expect(() => parseEnvVars(input)).toThrow('Empty key on line 1');
    });

    it('should handle empty values', () => {
        const input = 'EMPTY_VAR=';
        const result = parseEnvVars(input);

        expect(result).toEqual([{ name: 'EMPTY_VAR', value: '' }]);
    });

    it('should handle complex multiline input', () => {
        const input = `
# Database config
DB_HOST=localhost
DB_PORT=5432
DB_PASSWORD=p@ss=w0rd!

# App config
NODE_ENV=production
LOG_LEVEL=debug
    `;

        const result = parseEnvVars(input);

        expect(result).toEqual([
            { name: 'DB_HOST', value: 'localhost' },
            { name: 'DB_PORT', value: '5432' },
            { name: 'DB_PASSWORD', value: 'p@ss=w0rd!' },
            { name: 'NODE_ENV', value: 'production' },
            { name: 'LOG_LEVEL', value: 'debug' },
        ]);
    });
});
