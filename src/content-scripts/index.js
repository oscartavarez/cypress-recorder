import eventsToRecord from '../code-generator/dom-events-to-record'
import elementsToBindTo from '../code-generator/elements-to-bind-to'
import finder from '@medv/finder'

class EventRecorder {
  constructor () {
    this.eventLog = []
    this.previousEvent = null
  }

  start () {
    chrome.storage.local.get(['options'], ({ options }) => {
      const {dataAttribute} = options ? options.code : {}
	  const startContext = this;
      if (dataAttribute) {
        this.dataAttribute = dataAttribute
      }

      const events = Object.values(eventsToRecord)
      if (!window.pptRecorderAddedControlListeners) {
        this.addAllListeners(elementsToBindTo, events)
        window.pptRecorderAddedControlListeners = true
      }

      if (!window.document.pptRecorderAddedControlListeners && chrome.runtime && chrome.runtime.onMessage) {
        const boundedGetCurrentUrl = this.getCurrentUrl.bind(this);
        const boundedGetViewPortSize = this.getViewPortSize.bind(this);
        chrome.runtime.onMessage.addListener(boundedGetCurrentUrl);
        chrome.runtime.onMessage.addListener(boundedGetViewPortSize);
        window.document.pptRecorderAddedControlListeners = true;
      }

	  chrome.storage.local.get('firstRun', function(items){
		  if(!items.hasOwnProperty('firstRun')){
			  chrome.storage.local.set({'firstRun': 0});
			  items.firstRun = 0;
		  }

		  if(items.hasOwnProperty('firstRun') && !items.firstRun){
			  startContext.sendMessage({ control: 'get-viewport-size', coordinates: { width: window.innerWidth, height: window.innerHeight } });
			  startContext.sendMessage({ control: 'get-current-url', href: window.location.href });
			  chrome.storage.local.set({'firstRun': 1});
		  }
	  });

      this.sendMessage({ control: 'event-recorder-started' });
      console.debug('Cypress Recorder in-page EventRecorder started')
    })
  }

  addAllListeners (elements, events) {
    const boundedRecordEvent = this.recordEvent.bind(this)
    events.forEach(type => {
      window.addEventListener(type, boundedRecordEvent, true)
    })
  }

  sendMessage (msg) {
    console.debug('sending message', msg)
    try {
      // poor man's way of detecting whether this script was injected by an actual extension, or is loaded for
      // testing purposes
      if (chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.sendMessage(msg)
      } else {
        this.eventLog.push(msg)
      }
    } catch (err) {
      console.debug('caught error', err)
    }
  }

  getCurrentUrl (msg) {
    if (msg.control && msg.control === 'get-current-url') {
      console.debug('sending current url:', window.location.href)
      this.sendMessage({ control: msg.control, href: window.location.href })
    }
  }

  getViewPortSize (msg) {
    if (msg.control && msg.control === 'get-viewport-size') {
      console.debug('sending current viewport size')
      this.sendMessage({ control: msg.control, coordinates: { width: window.innerWidth, height: window.innerHeight } })
    }
  }

  getDataAttributeContainer (element) {
    if (!element) return

    if (element.attributes[this.dataAttribute]) {
      return element
    }

    if (element.parentElement) {
      return this.getDataAttributeContainer(element.parentElement)
    }

    return null
  }

  recordEvent (e) {
    if (this.previousEvent && this.previousEvent.timeStamp === e.timeStamp) return
    this.previousEvent = e

    const dataAttributeContainer = this.getDataAttributeContainer(e.target)

    const selector = dataAttributeContainer
      ? formatDataSelector(dataAttributeContainer, this.dataAttribute)
      : finder(e.target, { seedMinLength: 5, optimizedMinLength: 10 })

    const msg = {
      selector: selector,
      value: e.target.value,
      tagName: e.target.tagName,
      targetType: e.target.type,
      action: e.type,
      keyCode: e.keyCode ? e.keyCode : null,
      href: e.target.href ? e.target.href : null,
      coordinates: getCoordinates(e),
	  targetObject: e.target
    }
    this.sendMessage(msg)
  }

  getEventLog () {
    return this.eventLog
  }

  clearEventLog () {
    this.eventLog = []
  }
}

function getCoordinates (evt) {
  const eventsWithCoordinates = {
    mouseup: true,
    mousedown: true,
    mousemove: true,
    mouseover: true
  }
  return eventsWithCoordinates[evt.type] ? { x: evt.clientX, y: evt.clientY } : null
}

function formatDataSelector (element, attribute) {
  return `[${attribute}=${element.getAttribute(attribute)}]`
}

window.eventRecorder = new EventRecorder()
window.eventRecorder.start()
