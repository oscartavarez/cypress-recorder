import domEvents from './dom-events-to-record'
import pptrActions from './pptr-actions'
import Block from './Block'

const wrapDescribeHeader = `describe('test_name', function() {\n`

const wrapDescribeFooter = `})`;

const wrapItHeader = ` it('what_it_does', function() {\n`

const wrapItFooter = ` })\n`

export const defaults = {
  wrapDescribe: true,
  blankLinesBetweenBlocks: true,
  dataAttribute: '',
  insertWaitCommands: false
}

export default class CodeGenerator {
  constructor (options) {
    this._options = Object.assign(defaults, options);
    this._blocks = [];
    this._frame = 'cy';
    this._frameId = 0;
    this._allFrames = {};

    this._hasNavigation = false;
  }

  generate (events) {
    return this._getHeader() + this._parseEvents(events) + this._getFooter();
  }

  _getHeader () {

    let newLine = '';

    if (this._options.blankLinesBetweenBlocks) {
    	newLine = `\n`;
	}

    let describeHeader = this._options.wrapDescribe ? wrapDescribeHeader + newLine : '';
    return describeHeader + wrapItHeader + newLine;
  }

  _getFooter () {

    let newLine = '';

    if (this._options.blankLinesBetweenBlocks) {
    	newLine = `\n`;
	}

    //return this._options.wrapAsync ? wrappedFooter : footer
    let describeFooter = this._options.wrapDescribe ? wrapDescribeFooter + newLine : '';
	return wrapItFooter + newLine + describeFooter;
  }

  _parseEvents (events) {
    console.debug(`generating code for ${events ? events.length : 0} events`);
    let result = '';

    for (let i = 0; i < events.length; i++) {
      const { action, selector, value, href, keyCode, tagName, targetType, frameId, frameUrl, timeStamp } = events[i]

      // we need to keep a handle on what frames events originate from
      this._setFrames(frameId, frameUrl);

      if (this._options.insertWaitCommands) {
        // Determine wait ms duration by subtracting the previous event
        // time stamp from the time stamp of the current event being parsed
        const waitMs = i > 0 ? timeStamp - events[i - 1].timeStamp : Date.now() - timeStamp

        if (waitMs) {
          this._blocks.push(
            new Block(this._frameId, { type: null, value: `${this._frame}.wait(${waitMs});` })
          )
        }
      }

      switch (action) {
        case 'keydown':
          if (keyCode === 9) {
            //this._blocks.push(this._handleKeyDown(selector, value, keyCode))
          }
          break
        case 'click':
          this._blocks.push(this._handleClick(selector, events));
          break;
        case 'change':
          if (tagName === 'SELECT') {
            this._blocks.push(this._handleChange(tagName, selector, value));
          }
          if (tagName === 'INPUT') {
			if(targetType){
            	this._blocks.push(this._handleChange(tagName, selector, value, targetType));
			} else {
            	this._blocks.push(this._handleChange(tagName, selector, value));
			}
          }
          break
        case 'goto*':
          this._blocks.push(this._handleGoto(href, frameId));
          break
        case 'viewport*':
          this._blocks.push((this._handleViewport(value.width, value.height)));
          break
        case 'navigation*':
          this._blocks.push(this._handleWaitForNavigation());
          this._blocks.push(this._handleGoto(href, frameId));
          this._hasNavigation = true;
          break;
      }
    }

    const indent = this._options.wrapDescribe ? '    ' : '   ';
    let newLine = `\n`;

    if (this._options.blankLinesBetweenBlocks && this._blocks.length > 0) {
    	newLine = `\n \n`;
	}

    for (let block of this._blocks) {
      const lines = block.getLines();
      for (let line of lines) {
        result += indent + line.value + newLine;
      }
    }

    return result;
  }

  _setFrames (frameId, frameUrl) {
    if (frameId && frameId !== 0) {
      this._frameId = frameId;
      this._frame = `frame_${frameId}`;
      this._allFrames[frameId] = frameUrl;
    } else {
      this._frameId = 0;
      this._frame = 'cy';
    }
  }

  _postProcess () {
    // when events are recorded from different frames, we want to add a frame setter near the code that uses that frame
    if (Object.keys(this._allFrames).length > 0) {
      this._postProcessSetFrames();
    }

    if (this._options.blankLinesBetweenBlocks && this._blocks.length > 0) {
      this._postProcessAddBlankLines();
    }
  }

  _handleKeyDown (selector, value) {
    const block = new Block(this._frameId);
    block.addLine({ type: domEvents.KEYDOWN, value: `${this._frame}.get('${selector}').type('${value}')`});
    return block;
  }

  _handleClick (selector) {
    const block = new Block(this._frameId);
    block.addLine({ type: domEvents.CLICK, value: `${this._frame}.get('${selector}').click()` });
    return block;
  }

  _handleChange (tagName, selector, value, targetType) {

    if (tagName === 'INPUT') {
		if (targetType === 'checkbox') {
			return new Block(this._frameId, { type: domEvents.CHANGE, value: `${this._frame}.get('${selector}').check('${value}')`});
		}
    	return new Block(this._frameId, { type: domEvents.CHANGE, value: `${this._frame}.get('${selector}').type('${value}')`});
	}

    return new Block(this._frameId, { type: domEvents.CHANGE, value: `${this._frame}.get('${selector}').select('${value}')`});
  }

  _handleGoto (href) {
    return new Block(this._frameId, { type: pptrActions.GOTO, value: `${this._frame}.visit('${href}')` });
  }

  _handleViewport (width, height) {
    return new Block(this._frameId, { type: pptrActions.VIEWPORT, value: `${this._frame}.viewport(${width}, ${height})` });
  }

  _handleWaitForNavigation () {
    const block = new Block(this._frameId);
    return block;
  }

  _postProcessSetFrames () {
    for (let [i, block] of this._blocks.entries()) {
      const lines = block.getLines();
      for (let line of lines) {
        if (line.frameId && Object.keys(this._allFrames).includes(line.frameId.toString())) {
          const declaration = `const frame_${line.frameId} = frames.find(f => f.url() === '${this._allFrames[line.frameId]}')`;
          this._blocks[i].addLineToTop(({ type: pptrActions.FRAME_SET, value: declaration }));
          this._blocks[i].addLineToTop({ type: pptrActions.FRAME_SET, value: 'let frames = await page.frames()' });
          delete this._allFrames[line.frameId];
          break;
        }
      }
    }
  }

  _postProcessAddBlankLines () {
    let i = 0;
    while (i <= this._blocks.length) {
      const blankLine = new Block();
      blankLine.addLine({ type: null, value: '' });
      this._blocks.splice(i, 0, blankLine);
      i += 2;
    }
  }
}
