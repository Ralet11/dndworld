const test = require('node:test');
const assert = require('node:assert/strict');

const { isAllowedMediaKey, safeSegment } = require('../utils/s3Storage');

test('media keys allow repeated dots inside a filename', () => {
    assert.equal(
        isAllowedMediaKey('production/images/example-05_49_33-p.m..png', 'production'),
        true,
    );
});

test('media keys reject traversal segments and keys outside the prefix', () => {
    assert.equal(isAllowedMediaKey('production/../secret.png', 'production'), false);
    assert.equal(isAllowedMediaKey('production/images/../../secret.png', 'production'), false);
    assert.equal(isAllowedMediaKey('other/images/map.png', 'production'), false);
    assert.equal(isAllowedMediaKey('production\\images\\map.png', 'production'), false);
});

test('generated filename segments do not retain trailing dots', () => {
    assert.equal(safeSegment('ChatGPT Image 05_49_33 p.m.'), 'chatgpt-image-05_49_33-p.m');
});
