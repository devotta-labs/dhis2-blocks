import '../../../../apps/web/src/index.css'
import '../../../../apps/web/src/applyApplicationTheme'

if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined
}
