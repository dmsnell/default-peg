/////////////////////////////////////////////////////////////////////
/// Parsers
/////////////////////////////////////////////////////////////////////

function blockList( document, index ) {
	const blocks = zeroOrMore( choice( block, sequence( not( block ), any ) ) )( document, index );

	if ( ! blocks ) {
		return null;
	}

	if ( ! blocks[ 1 ].length ) {
		return [ document.length, [ freeform( document, index, document.length ) ] ];
	}

	const output = [];
	for ( let i = 0; i < blocks[ 1 ].length; i++ ) {
		const nextBlockSet = [].concat( blocks[ 1 ][ i ] );
		for ( let j = 0; j < nextBlockSet.length; j++ ) {
			const nextBlock = nextBlockSet[ j ];
			const lastOutput = output[ output.length - 1 ];

			if ( null === nextBlock ) {
				continue;
			} else if ( 'string' === typeof nextBlock && ( ! lastOutput || null !== lastOutput.blockName ) ) {
				output.push( { blockName: null, attrs: {}, innerBlocks: [], innerContent: [ nextBlock ], innerHTML: nextBlock } );
			} else if ( 'string' === typeof nextBlock && ( lastOutput && null === lastOutput.blockName ) ){
				lastOutput.innerContent[ 0 ] += nextBlock;
				lastOutput.innerHTML += nextBlock;
			} else if ( null === nextBlock.blockName && ( ! lastOutput || null !== lastOutput.blockName ) ) {
				output.push( { blockName: null, attrs: {}, innerBlocks: [], innerContent: [ nextBlock.innerHTML ], innerHTML: nextBlock.innerHTML } );
			} else if ( null === nextBlock.blockName && ( lastOutput && null === lastOutput.blockName ) ) {
				lastOutput.innerContent[ 0 ] += nextBlock.innerHTML;
				lastOutput.innerHTML += nextBlock.innerHTML;
				continue;
			} else {
				output.push( nextBlock );
			}
		}
	}

	if ( blocks[ 0 ] < document.length ) {
		output.push( freeform( document, blocks[ 0 ], document.length ) );
	}

	return [ document.length, output ];
};

function block( document, index ) {
	const opener = choice( voidBlockOpener, blockOpener )( document, index );

	if ( ! opener ) {
		return null;
	}

	const openerEnd = opener[ 0 ];
	const blockName = opener[ 1 ][ 0 ];
	const attrs = opener[ 1 ][ 1 ];
	const isVoid = opener[ 1 ][ 2 ];

	if ( isVoid ) {
		return [ 
			openerEnd,
			{
				blockName: blockName,
				attrs: attrs,
				innerBlocks: [],
				innerHTML: '',
				innerContent: []
			}
		]
	}

	const innerBlockPairs = zeroOrMore( choice(
		block,
		sequence( not( block ), not( blockCloser ), any )
	) )( document, openerEnd );

	let innerHTML = '';
	const innerBlocks = [];
	const innerContent = [];
	for ( let i = 0; i < innerBlockPairs[ 1 ].length; i++ ) {
		const nextBlockSet = [].concat( innerBlockPairs[ 1 ][ i ] );
		for ( let j = 0; j < nextBlockSet.length; j++ ) {
			const nextBlock = nextBlockSet[ j ];

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

	const closing = blockCloser( document, innerBlockPairs[ 0 ] );

	if ( null === closing ) {
		return null;
	}

	return [ 
		closing[ 0 ], 
		{
			blockName: blockName,
			attrs: attrs,
			innerBlocks: innerBlocks,
			innerHTML: innerHTML,
			innerContent: innerContent
		}
	]
};

function blockCloser( document, index ) {
	const closer = /<!--\s+\/wp:([a-z][a-z0-9_-]*\/)?([a-z][a-z0-9_-]*)\s+-->/g;
	closer.lastIndex = index;
	const closing = closer.exec( document );

	if ( ! closing || closing.index !== index ) {
		return null;
	}

	const namespaceMatch = closing[ 1 ];
	const nameMatch = closing[ 2 ];
	const namespace = namespaceMatch || 'core/';
	const blockName = namespace + nameMatch;

	return [ closer.lastIndex, blockName ];
};

function blockOpener( document, index ) {
	return choice( voidBlockOpener, nonVoidBlockOpener )( document, index );
}

function nonVoidBlockOpener( d, i ) {
	const s = sequence(
		commonBlockOpener,
		commentCloser,
	)( d, i );

	return s ? [ s[ 0 ], s[ 1 ][ 0 ].concat( false ) ] : null;
}

function voidBlockOpener( d, i ) {
	const s = sequence(
		commonBlockOpener,
		( doc, idx ) => patternMatch( doc, idx, /\//g ),
		commentCloser,
	)( d, i );

	return s ? [ s[ 0 ], s[ 1 ][ 0 ].concat( true ) ] : null;
}

function commonBlockOpener( document, index ) {
	const opener = /<!--\s+wp:([a-z][a-z0-9_-]*\/)?([a-z][a-z0-9_-]*)\s+({(?:[^}]+|}+(?=})|(?!}\s+(?:\/)?-->)[^])*?}\s+)?/g;
	opener.lastIndex = index;
	const opening = opener.exec( document );

	if ( ! opening || opening.index !== index ) {
		return null;
	}

	const namespaceMatch = opening[ 1 ];
	const nameMatch = opening[ 2 ];
	const attrsMatch = opening[ 3 ];

	const namespace = namespaceMatch || 'core/';
	const blockName = namespace + nameMatch;
	const hasAttrs = !! attrsMatch;
	let attrs = hasAttrs ? attrsMatch : '{}';
	try {
		attrs = JSON.parse( attrs );
	} catch ( e ) {
		return null;
	}

	return [ opener.lastIndex, [ blockName, attrs ] ];
};

function commentCloser( document, index ) {
	return patternMatch( document, index, /-->/g );
};

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
		let things = [];
		let lastIndex = index;
		let thing = parser( document, lastIndex );

		while ( thing && lastIndex < document.length) {
			lastIndex = thing[ 0 ];
			things = things.concat( Array.isArray( thing[ 1 ] ) ? [ thing[ 1 ] ] : thing[ 1 ] );

			thing = parser( document, lastIndex );
		}

		return [ lastIndex, things ];
	}
}

function oneOrMore( parser ) {
	return ( document, index ) => {
		let things = [];
		let lastIndex = index;
		let thing = parser( document, lastIndex );

		if ( ! thing ) {
			return null;
		}

		while ( thing && lastIndex < document.length) {
			lastIndex = thing[ 0 ];
			things = things.concat( Array.isArray( thing[ 1 ] ) ? [ thing[ 1 ] ] : thing[ 1 ] );

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

	return parser;
}

function not( parser ) {
	return ( document, index ) => {
		const match = parser( document, index );

		return match ? null : [ index, null ];
	};
}

function sequence( ...parsers ) {
	const parser = ( document, index ) => {
		let things = [];
		let lastIndex = index;
		let thing;

		for ( let i = 0; i < parsers.length; i++ ) {
			thing = parsers[ i ]( document, lastIndex );

			if ( null === thing ) {
				return null;
			}

			if ( lastIndex !== thing[ 0 ] ) {
				things = things.concat( Array.isArray( thing[ 1 ] ) ? [ thing[ 1 ] ] : thing[ 1 ] );
				lastIndex = thing[ 0 ];
			}
		}

		return [ lastIndex, things ];
	}

	parser.displayName = `sequence: [${ parsers.map( p => p.displayName || p.name || p ).join( ' -> ' ) }]`;

	return parser;
}

/////////////////////////////////////////////////////////////////////
/// Exports
/////////////////////////////////////////////////////////////////////

module.exports = {
	blockList: blockList,
	block: block,
	blockCloser: blockCloser,
	blockOpener: blockOpener,
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
