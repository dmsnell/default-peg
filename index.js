/////////////////////////////////////////////////////////////////////
/// Parsers
/////////////////////////////////////////////////////////////////////

const blockList = augment( function blockList( document, index ) {
	const blocks = zeroOrMore( choice( block, sequence( not( block ), any ) ) )( document, index );

	if ( ! blocks ) {
		return null;
	}

	if ( ! blocks[ 1 ].length ) {
		return [ document.length, [ freeform( document, index, document.length ) ] ];
	}

	const output = [];
	for ( let i = 0; i < blocks[ 1 ].length; i++ ) {
		const nextBlock = blocks[ 1 ][ i ];
		for ( let j = 0; j < nextBlock.length; j++ ) {
			const lastOutput = output[ output.length - 1 ];

			if ( null === nextBlock[ j ] ) {
				continue;
			} else if ( 'string' === typeof nextBlock[ j ] && ( ! lastOutput || null !== lastOutput.blockName ) ) {
				output.push( { blockName: null, attrs: {}, innerBlocks: [], innerContent: [ nextBlock[ j ] ], innerHTML: nextBlock[ j ] } );
			} else if ( 'string' === typeof nextBlock[ j ] && ( lastOutput && null === lastOutput.blockName ) ){
				lastOutput.innerContent[ 0 ] += nextBlock[ j ];
				lastOutput.innerHTML += nextBlock[ j ];
			} else if ( null === nextBlock[ j ].blockName && ( ! lastOutput || null !== lastOutput.blockName ) ) {
				output.push( { blockName: null, attrs: {}, innerBlocks: [], innerContent: [ nextBlock[ j ].innerHTML ], innerHTML: nextBlock[ j ].innerHTML } );
			} else if ( null === nextBlock[ j ].blockName && ( lastOutput && null === lastOutput.blockName ) ) {
				lastOutput.innerContent[ 0 ] += nextBlock[ j ].innerHTML;
				lastOutput.innerHTML += nextBlock[ j ].innerHTML;
				continue;
			} else {
				output.push( nextBlock[ j ] );
			}
		}
	}

	if ( blocks[ 0 ] < document.length ) {
		output.push( freeform( document, blocks[ 0 ], document.length ) );
	}

	return [ document.length, output ];
} );

const block = augment( function block( document, index ) {
	const opener = /<!--\s+wp:([a-z][a-z0-9_-]*\/)?([a-z][a-z0-9_-]*)\s+({(?:[^}]+|}+(?=})|(?!}\s+-->)[^])*?}\s+)?(\/)?-->/g;
	opener.lastIndex = index;
	const opening = opener.exec( document );

	if ( null === opening || opening.index !== index ) {
		return null;
	}

	const namespaceMatch = opening[ 1 ];
	const nameMatch = opening[ 2 ];
	const attrsMatch = opening[ 3 ];
	const voidMatch = opening[ 4 ];

	const isVoid = !! voidMatch;
	const namespace = namespaceMatch || 'core/';
	const name = namespace + nameMatch;
	const hasAttrs = !! attrsMatch;
	const attrs = hasAttrs ? JSON.parse( attrsMatch ) : {};

	if ( isVoid ) {
		const next = {
			blockName: name,
			attrs: attrs,
			innerBlocks: [],
			innerHTML: '',
			innerContent: []
		};

		return [ opener.lastIndex, [ next ] ]
	}

	const innerBlockPairs = zeroOrMore(
		choice(
			block,
			sequence(
				not( block ),
				not( ( doc, idx ) => patternMatch( doc, idx, /<!--\s+\/wp:([a-z][a-z0-9_-]*\/)?([a-z][a-z0-9_-]*)\s+-->/ ) ),
				any
			)
		) )( document, opener.lastIndex );

	let innerHTML = '';
	const innerBlocks = [];
	const innerContent = [];
	for ( let i = 0; i < innerBlockPairs[ 1 ].length; i++ ) {
		const nextBlockPair = innerBlockPairs[ 1 ][ i ];
		for ( let j = 0; j < nextBlockPair.length; j++ ) {
			const nextBlock = nextBlockPair[ j ];

			if ( null === nextBlock ) {
				continue;
			}

			if ( 'string' === typeof nextBlock ) {
				innerHTML += nextBlock;

				if ( 'string' === typeof innerContent[ innerContent.length - 1 ] ) {
					innerContent[ innerContent.length - 1 ] += nextBlock;
				} else {
					innerContent.push( nextBlock );
				}
			} else if ( null === nextBlock.blockName ) {
				innerHTML += nextBlock.innerHTML;

				if ( 'string' === typeof innerContent[ innerContent.length - 1 ] ) {
					innerContent[ innerContent.length - 1 ] += nextBlock.innerHTML;
				} else {
					innerContent.push( nextBlock.innerHTML );
				}
			} else {
				innerBlocks.push( nextBlock );
				innerContent.push( null );
			}
		}
	}

	const closer = /<!--\s+\/wp:([a-z][a-z0-9_-]*\/)?([a-z][a-z0-9_-]*)\s+-->/g;
	closer.lastIndex = innerBlockPairs[ 0 ];
	const closing = closer.exec( document );

	if ( null === closing ) {
		return null;
	}

	if ( innerBlockPairs[ 0 ] < closing.index ) {
		const html = document.slice( innerBlockPairs[ 0 ], closing.index );
		innerHTML += html;
		innerContent.push( html );
	}

	const next = {
		blockName: name,
		attrs: attrs,
		innerBlocks: innerBlocks,
		innerHTML: innerHTML,
		innerContent: innerContent
	};

	return [ closer.lastIndex, [ next ] ]
} );

/////////////////////////////////////////////////////////////////////
/// Helpers
/////////////////////////////////////////////////////////////////////

function any( document, index ) {
	return index < document.length ? [ index + 1, document[ index ] ] : null;
}

function whitespace( document, index ) {
	return patternMatch( document, index, /\s+/g );
}

function freeform( document, start, end ) {
	const html = document.slice( start, end );

	return {
		blockName: null,
		attrs: {},
		innerBlocks: [],
		innerHTML: html,
		innerContent: [ html ]
	};
}

function patternMatch( document, index, pattern ) {
	pattern.lastIndex = index;

	const match = pattern.exec( document );
	if ( ! match || match.index !== index ) {
		return null;
	}

	return [ pattern.lastIndex, match[ 0 ] ];
}

/////////////////////////////////////////////////////////////////////
/// Parser Combinators
/////////////////////////////////////////////////////////////////////

function zeroOrMore( parser ) {
	return ( document, index ) => {
		const things = [];
		let lastIndex = index;
		let thing = parser( document, lastIndex );

		while ( thing ) {
			lastIndex = thing[ 0 ];
			things.push( thing[ 1 ] );

			thing = parser( document, lastIndex );
		}

		return [ lastIndex, things ];
	}
}

function oneOrMore( parser ) {
	return ( document, index ) => {
		const things = [];
		let lastIndex = index;
		let thing = parser( document, lastIndex );

		if ( ! thing ) {
			return null;
		}

		while ( thing ) {
			lastIndex = thing[ 0 ];
			things.push( thing[ 1 ] );

			thing = parser( document, lastIndex );
		}

		return [ lastIndex, things ];
	}
}

function choice( ...parsers ) {
	const parser = ( document, index ) => {
		for ( let i = 0; i < parsers.length; i++ ) {
			const parsed = parsers[ i ]( document, index );
			if ( parsed ) {
				return parsed;
			}
		}

		return null;
	};

	parser.displayName = `choice: [${ parsers.map( p => p.name ).join( ' / ' ) }]`;

	return augment( parser );
}

function not( parser ) {
	return ( document, index ) => {
		const match = parser( document, index );

		return match ? null : [ index, [] ];
	};
}

function sequence( ...parsers ) {
	return ( document, index ) => {
		let things = [];
		let lastIndex = index;
		let thing;

		for ( let i = 0; i < parsers.length; i++ ) {
			thing = parsers[ i ]( document, lastIndex );

			if ( null === thing ) {
				return null;
			}

			lastIndex = thing[ 0 ];
			things = things.concat( thing[ 1 ] );
		}

		return [ lastIndex, things ];
	}
}

/////////////////////////////////////////////////////////////////////
/// Wrappers
/////////////////////////////////////////////////////////////////////

function augment( f ) {
	return f;

	return ( ...args ) => {
		console.log( `Entering ${ f.displayName || f.name } at ${ args[ 1 ] }` );
		const r = f( ...args );
		console.log( `Returned from ${ f.name }:`, r );
		return r;
	};
}

/////////////////////////////////////////////////////////////////////
/// Exports
/////////////////////////////////////////////////////////////////////

module.exports = {
	blockList: blockList,
	block: block,
	choice: choice,
	not: not,
	oneOrMore: oneOrMore,
	sequence: sequence,
	whitespace: whitespace,
	zeroOrMore: zeroOrMore,
	parse: ( document ) => {
		const output = blockList( document, 0 );

		return output ? output[ 1 ] : freeform( document, 0, document.length );
	}
};
