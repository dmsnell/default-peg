const parser = require( '../index.js' );

const blockList = parser.blockList;
const block = parser.block;
const blockCloser = parser.blockCloser;
const blockOpener = parser.blockOpener;
const choice = parser.choice;
const not = parser.not;
const oneOrMore = parser.oneOrMore;
const sequence = parser.sequence;
const whitespace = parser.whitespace;
const zeroOrMore = parser.zeroOrMore;

describe( 'parser combinators', () => {
    const fail = ( document, index ) => null;
    const succeed = ( document, index ) => [ index + 1, [ true ] ];

    describe( 'zeroOrMore', () => {
        test( 'zero matches', () => {
            expect( zeroOrMore( fail )( '', 0 ) ).toEqual( [ 0, [] ] );
        } );

        test( 'one match', () => {
            const a = ( doc, index ) => doc[ index ] === 'a' ? [ index + 1, 'a' ] : null;

            expect( zeroOrMore( a )( 'a', 0 ) ).toEqual( [ 1, [ 'a' ] ] );
        } );

        test( 'two matches', () => {
            const a = ( doc, index ) => doc[ index ] === 'a' ? [ index + 1, 'a' ] : null;

            expect( zeroOrMore( a )( 'aa', 0 ) ).toEqual( [ 2, [ 'a', 'a' ] ] );
        } );

        test( 'many matches', () => {
            const a = ( doc, index ) => doc[ index ] === 'a' ? [ index + 1, 'a' ] : null;

            expect( zeroOrMore( a )( 'aaaaaa', 0 ) ).toEqual( [ 6, [ 'a', 'a', 'a', 'a', 'a', 'a' ] ] );
        } );

        test( 'multiple arrays', () => {
            const a = ( doc, index ) => doc[ index ] === 'a' ? [ index + 1, [ 'a' ] ] : null;

            expect( zeroOrMore( a )( 'aaa', 0 ) ).toEqual( [ 3, [ [ 'a' ], [ 'a' ], [ 'a' ] ] ] );
        } );
    } );

    describe( 'oneOrMore', () => {
        test( 'zero matches', () => {
            expect( oneOrMore( fail )( '', 0 ) ).toBeNull();
        } );

        test( 'one match', () => {
            const a = ( doc, index ) => doc[ index ] === 'a' ? [ index + 1, 'a' ] : null;

            expect( oneOrMore( a )( 'a', 0 ) ).toEqual( [ 1, [ 'a' ] ] );
        } );

        test( 'two matches', () => {
            const a = ( doc, index ) => doc[ index ] === 'a' ? [ index + 1, 'a' ] : null;

            expect( oneOrMore( a )( 'aa', 0 ) ).toEqual( [ 2, [ 'a', 'a' ] ] );
        } );

        test( 'many matches', () => {
            const a = ( doc, index ) => doc[ index ] === 'a' ? [ index + 1, 'a' ] : null;

            expect( oneOrMore( a )( 'aaaaaa', 0 ) ).toEqual( [ 6, [ 'a', 'a', 'a', 'a', 'a', 'a' ] ] );
        } );

        test( 'multiple arrays', () => {
            const a = ( doc, index ) => doc[ index ] === 'a' ? [ index + 1, [ 'a' ] ] : null;

            expect( oneOrMore( a )( 'aaa', 0 ) ).toEqual( [ 3, [ [ 'a' ], [ 'a' ], [ 'a' ] ] ] );
        } );
    } );

    describe( 'choice', () => {
        test( 'one parser', () => {
            expect( choice( succeed )( 'test', 0 ) ).toEqual( [ 1, [ true ] ] );
        } );

        test( 'two parsers, first succeeds', () => {
            expect( choice( succeed, fail )( 'test', 0 ) ).toEqual( [ 1, [ true ] ] );
        } );

        test( 'two parsers, first fails', () => {
            expect( choice( fail, succeed )( 'test', 0 ) ).toEqual( [ 1, [ true ] ] );
        } );

        test( 'two parsers, both fail', () => {
            expect( choice( fail, fail )( 'test', 0 ) ).toBeNull();
        } );

        test( 'succeeds on first success', () => {
            const a = ( doc, index ) => doc.substr( index, 3 ) === 'hat' ? 'hat' : null;
            const b = ( doc, index ) => doc.substr( index, 4 ) === 'hate' ? 'hate' : null;

            expect( choice( a, b )( 'hate', 0 ) ).toEqual( 'hat' );
        } );
    } );

    describe( 'sequence', () => {
        test( 'succeeds with all', () => {
            expect( sequence( succeed, succeed, succeed )( '', 0 ) ).toEqual( [ 3, [ [ true ], [ true ], [ true ] ] ] );
        } );

        test( 'fails with one', () => {
            expect( sequence( fail, succeed, succeed )( '', 0 ) ).toBeNull();
            expect( sequence( succeed, fail, succeed )( '', 0 ) ).toBeNull();
            expect( sequence( succeed, succeed, fail )( '', 0 ) ).toBeNull();
        } );
    } );

    describe( 'not', () => {
        test( 'fails on match', () => {
            const match = ( doc, index ) => doc[ index ] === 'a' ? [ index + 1, 'a' ] : null;

            expect( match( 'a', 0 ) ).toEqual( [ 1, 'a' ] );
            expect( match( 'b', 0 ) ).toBeNull();

            expect( not( match )( 'a', 0 ) ).toBeNull();
        } );

        test( 'succeeds on no-match', () => {
            const match = ( doc, index ) => doc[ index ] === 'a' ? [ index + 1, 'a' ] : null;

            expect( match( 'a', 0 ) ).toEqual( [ 1, 'a' ] );
            expect( match( 'b', 0 ) ).toBeNull();

            expect( sequence( not( match ), succeed )( 'b', 0 ) ).toEqual( [ 1, [ [ true ] ] ] );
        } );
    } );
} );

describe( 'parser components', () => {
    describe( 'blockList', () => {
        test( 'plain text', () => {
            expect( blockList( 'test' ) ).toEqual( [ 4, [
                {
                    blockName: null,
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: 'test',
                    innerContent: [ 'test' ]
                }
            ] ] );
        } );

        test( 'single block', () => {
            expect( blockList( '<!-- wp:void /-->', 0 ) ).toEqual( [ 17, [ {
                blockName: 'core/void',
                attrs: {},
                innerBlocks: [],
                innerHTML: '',
                innerContent: []
            } ] ] );
        } );

        test( 'block with leading HTML', () => {
            expect( blockList( 'boo!<!-- wp:void /-->', 0 ) ).toEqual( [ 21, [ 
                {
                    blockName: null,
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: 'boo!',
                    innerContent: [ 'boo!' ]
                },
                {
                    blockName: 'core/void',
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: '',
                    innerContent: []
                }
            ] ] ); 
        } );

        test( 'block with trailing HTML', () => {
            expect( blockList( '<!-- wp:void /-->boo!', 0 ) ).toEqual( [ 21, [ 
                {
                    blockName: 'core/void',
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: '',
                    innerContent: []
                },
                {
                    blockName: null,
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: 'boo!',
                    innerContent: [ 'boo!' ]
                }
            ] ] ); 
        } );

        test( 'two blocks', () => {
            expect( blockList( '<!-- wp:void /--><!-- wp:void /-->', 0 ) ).toEqual( [ 34, [ 
                {
                    blockName: 'core/void',
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: '',
                    innerContent: []
                },
                {
                    blockName: 'core/void',
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: '',
                    innerContent: []
                }
            ] ] );
        } );

        test( 'two blocks whose first is missing a closer', () => {
            expect( blockList( '<!-- wp:first --><!-- wp:last --><!-- /wp:last -->', 0 ) ).toEqual( [ 50, [ 
                {
                    blockName: null,
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: '<!-- wp:first -->',
                    innerContent: [ '<!-- wp:first -->' ]
                },
                {
                    blockName: 'core/last',
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: '',
                    innerContent: []
                }
            ] ] );
        } );

        test( 'two blocks whose second is missing a closer', () => {
            expect( blockList( '<!-- wp:first --><!-- /wp:first --><!-- wp:last -->', 0 ) ).toEqual( [ 51, [ 
                {
                    blockName: 'core/first',
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: '',
                    innerContent: []
                },
                {
                    blockName: null,
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: '<!-- wp:last -->',
                    innerContent: [ '<!-- wp:last -->' ]
                }
            ] ] );
        } );

        test( 'two blocks with leading HTML', () => {
            expect( blockList( 'first<!-- wp:void /-->second<!-- wp:void /-->', 0 ) ).toEqual( [ 45, [ 
                {
                    blockName: null,
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: 'first',
                    innerContent: [ 'first' ]
                },
                {
                    blockName: 'core/void',
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: '',
                    innerContent: []
                },
                {
                    blockName: null,
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: 'second',
                    innerContent: [ 'second' ]
                },
                {
                    blockName: 'core/void',
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: '',
                    innerContent: []
                }
            ] ] );
        } );
    } );

    describe( 'block', () => {
        test( 'void block', () => {
            expect( block( '<!-- wp:void /-->', 0 ) ).toEqual( [
                17,
                {
                    blockName: 'core/void',
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: '',
                    innerContent: []
                }
            ] );
        } );

        test( 'void block with attributes', () => {
            expect( block( '<!-- wp:void {"a": "b"} /-->', 0 ) ).toEqual( [
                28,
                {
                    blockName: 'core/void',
                    attrs: { a: 'b' },
                    innerBlocks: [],
                    innerHTML: '',
                    innerContent: []
                }
            ] );
        } );

        test( 'balanced block', () => {
            expect( block( '<!-- wp:a --><!-- /wp:a -->', 0 ) ).toEqual( [
                27,
                {
                    blockName: 'core/a',
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: '',
                    innerContent: []
                }
            ] );
        } );

        test( 'balanced block with attributes', () => {
            expect( block( '<!-- wp:a {"a": "b"} --><!-- /wp:a -->', 0 ) ).toEqual( [ 
                38,
                { 
                    blockName: 'core/a',
                    attrs: { a: 'b' },
                    innerBlocks: [],
                    innerHTML: '',
                    innerContent: []
                }
            ] );
        } );

        test( 'balanced block with inner HTML', () => {
            expect( block( '<!-- wp:a -->inside<!-- /wp:a -->', 0 ) ).toEqual( [
                33, 
                {
                    blockName: 'core/a',
                    attrs: {},
                    innerBlocks: [],
                    innerHTML: 'inside',
                    innerContent: [ 'inside' ]
                }
            ] );
        } );

        test( 'balanced block with inner block', () => {
            expect( block( '<!-- wp:a --><!-- wp:void /--><!-- /wp:a -->', 0 ) ).toEqual( [ 
                44, 
                {
                    blockName: 'core/a',
                    attrs: {},
                    innerBlocks: [ {
                        blockName: 'core/void',
                        attrs: {},
                        innerBlocks: [],
                        innerHTML: '',
                        innerContent: []
                    } ],
                    innerHTML: '',
                    innerContent: [ null ]
                }
            ] );
        } );

        test( 'balanced block with inner block and HTML', () => {
            expect( block( '<!-- wp:a -->before<!-- wp:void /--><!-- /wp:a -->', 0 ) ).toEqual( [
                50, 
                {
                    blockName: 'core/a',
                    attrs: {},
                    innerBlocks: [ {
                        blockName: 'core/void',
                        attrs: {},
                        innerBlocks: [],
                        innerHTML: '',
                        innerContent: []
                    } ],
                    innerHTML: 'before',
                    innerContent: [ 'before', null ]
                }
            ] );

            expect( block( '<!-- wp:a -->before<!-- wp:b --><!-- /wp:b --><!-- /wp:a -->', 0 ) ).toEqual( [
                60,
                {
                    blockName: 'core/a',
                    attrs: {},
                    innerBlocks: [ {
                        blockName: 'core/b',
                        attrs: {},
                        innerBlocks: [],
                        innerHTML: '',
                        innerContent: []
                    } ],
                    innerHTML: 'before',
                    innerContent: [ 'before', null ]
                }
            ] );
        } );
    } );

    describe( 'block opener', () => {
        test( 'basic opener', () => {
            expect( blockOpener( '<!-- wp:block -->', 0 ) ).toEqual( [
                17,
                [ 'core/block', {}, false ]
            ] );
        } );

        test( 'void opener', () => {
            expect( blockOpener( '<!-- wp:block /-->', 0 ) ).toEqual( [
                18,
                [ 'core/block', {}, true ]
            ] );
        } );

        test( 'namespaced opener', () => {
            expect( blockOpener( '<!-- wp:my/block -->', 0 ) ).toEqual( [
                20,
                [ 'my/block', {}, false ]
            ] );
        } );

        test( 'opener with empty attributes', () => {
            expect( blockOpener( '<!-- wp:block {} -->', 0 ) ).toEqual( [
                20,
                [ 'core/block', {}, false ]
            ] );
        } );

        test( 'opener with non-empty attributes', () => {
            expect( blockOpener( '<!-- wp:block {"a":5} -->', 0 ) ).toEqual( [
                25,
                [ 'core/block', { a: 5 }, false ]
            ] );
        } );

        test( 'opener with invalid attributes', () => {
            expect( blockOpener( '<!-- wp:block {a: 5} -->', 0 ) ).toBeNull();
        } );
    } );

    describe( 'blockCloser', () => {
        test( 'basic closer', () => {
            expect( blockCloser( '<!-- /wp:block -->', 0 ) ).toEqual( [ 18, 'core/block' ] );
        } );

        test( 'namespaced closer', () => {
            expect( blockCloser( '<!-- /wp:my/block -->', 0 ) ).toEqual( [ 21, 'my/block' ] );
        } );
    } );

    describe( 'whitespace', () => {
        test( 'empty string', () => {
            expect( whitespace( '', 0 ) ).toBeNull();
        } );

        test( 'fully non-whitespace', () => {
            expect( whitespace( 'non-whitespace', 0 ) ).toBeNull();
        } );

        test( 'simple whitespace', () => {
            expect( whitespace( ' ', 0 ) ).toEqual( [ 1, ' ' ] );
            expect( whitespace( '\t', 0 ) ).toEqual( [ 1, '\t' ] );
        } );

        test( 'multiple whitespaces', () => {
            expect( whitespace( ' '.repeat( 50 ), 0 ) ).toEqual( [ 50, ' '.repeat( 50 ) ] );
        } );

        test( 'middle whitespace', () => {
            expect( whitespace( '123 567', 0 ) ).toBeNull();
            expect( whitespace( '123 567', 3 ) ).toEqual( [ 4, ' ' ] );
        } );
    } );
} );