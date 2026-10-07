import '../src/index.css'
import '../src/applyApplicationTheme'

if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined
}
