import { IccAuthApi, IccDocumentApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as _ from 'lodash'
import { XHR } from '../icc-api/api/XHR'
import * as models from '../icc-api/model/models'

import { a2b, hex2ua, string2ua, ua2string } from './utils/binary-utils'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { ShareResult } from './utils/ShareResult'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum

// noinspection JSUnusedGlobalSymbols
export class IccDocumentXApi extends IccDocumentApi {
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  /** maps invalid UTI values to corresponding MIME type for backward-compatibility (pre-v1.0.117) */
  compatUtiRevDefs: { [key: string]: string } = {
    'com.adobe.encapsulatedPostscript': 'image/eps',
    'com.adobe.illustrator.aiImage': 'application/illustrator',
    'com.adobe.indesignImage': 'image/indesign',
    'com.adobe.photoshopImage': 'image/psd',
    'com.adobe.postscriptPfaFont': 'application/x-font-type1',
    'com.adobe.postscriptPfbFont': 'application/x-font-type1',
    'com.allume.stuffitArchive': 'application/stuffit',
    'com.apple.binhexArchive': 'application/binhex',
    'com.apple.diskImageUdif': 'application/x-apple-diskimage',
    'com.apple.macbinaryArchive': 'application/macbinary',
    'com.apple.quartzComposerComposition': 'application/x-quartzcomposer',
    'com.apple.quicktimeImage': 'image/x-quicktime',
    'com.apple.quicktimeMovie': 'video/quicktime',
    'com.js.efxFax': 'image/efax',
    'com.macromedia.shockwaveFlash': 'application/x-shockwave-flash',
    'com.microsoft.advancedStreamRedirector': 'video/x-ms-asx',
    'com.microsoft.advancedSystemsFormat': 'video/x-ms-asf',
    'com.microsoft.waveformAudio': 'audio/wave',
    'com.microsoft.windowsDynamicLinkLibrary': 'application/x-msdownload',
    'com.microsoft.windowsExecutable': 'application/exe',
    'com.microsoft.windowsMediaWax': 'audio/x-ms-wax',
    'com.microsoft.windowsMediaWm': 'video/x-ms-wm',
    'com.microsoft.windowsMediaWma': 'audio/x-ms-wma',
    'com.microsoft.windowsMediaWmd': 'video/x-ms-wmd',
    'com.microsoft.windowsMediaWmp': 'video/x-ms-wmp',
    'com.microsoft.windowsMediaWmv': 'video/x-ms-wmv',
    'com.microsoft.windowsMediaWmx': 'video/x-ms-wmx',
    'com.microsoft.windowsMediaWmz': 'video/x-ms-wmz',
    'com.microsoft.windowsMediaWvx': 'video/x-ms-wvx',
    'com.netscape.javascriptSource': 'text/javascript',
    'com.pkware.zipArchive': 'application/zip',
    'com.rarlab.rarArchive': 'application/rar',
    'com.redhat.redhatPackage': 'application/x-redhat-package',
    'com.sgi.sgiImage': 'image/sgi',
    'com.sun.javaAppDescriptor': 'text/vnd.sun.j2me.app-descriptor',
    'com.sun.javaArchive': 'application/java-archive',
    'com.sun.javaClass': 'application/java',
    'com.sun.javaSource': 'text/x-java-source',
    'com.sun.javaWebStart': 'application/jnlp',
    'com.truevision.tgaImage': 'image/tga',
    'org.bzip.bzip2Archive': 'application/x-bzip2',
    'org.debian.debianPackage': 'application/x-debian-package',
    'org.gnu.gnuTarArchive': 'application/x-gtar',
    'org.gnu.gnuZipArchive': 'application/gzip',
    'org.oasis.opendocument.textMaster': 'application/vnd.oasis.opendocument.text-master',
    'org.oasis.opendocument.textWeb': 'application/vnd.oasis.opendocument.text-web',
    'org.xiph.oggTheora': 'video/ogg',
    'org.xiph.oggVorbis': 'audio/ogg',
    'public.aifcAudio': 'audio/aiff',
    'public.aiffAudio': 'audio/aiff',
    'public.assemblySource': 'text/x-asm',
    'public.cHeader': 'text/x-c-header',
    'public.cpioArchive': 'application/x-cpio',
    'public.cPlusPlusHeader': 'text/x-c++-hdr',
    'public.cPlusPlusSource': 'application/x-cplusplus',
    'public.cshScript': 'application/x-csh',
    'public.cSource': 'text/x-c-code',
    'public.isoImage': 'application/x-iso-image',
    'public.mpeg4Audio': 'audio/mp4',
    'public.objectiveCPlusPlusSource': 'text/x-objcppsrc',
    'public.objectiveCSource': 'text/x-objcsrc',
    'public.opentypeFont': 'font/opentype',
    'public.perlScript': 'text/x-perl',
    'public.phpScript': 'text/php',
    'public.plainText': 'text/plain',
    'public.pythonScript': 'text/x-python-script',
    'public.shellScript': 'application/x-sh',
    'public.tarArchive': 'application/tar',
    'public.truetypeTtfFont': 'application/x-font-ttf',
    'public.ulawAudio': 'audio/au',
    'public.xbitmapImage': 'image/xbm',
    'unofficial.atomFeed': 'application/atom+xml',
    'unofficial.m3u8Playlist': 'application/x-mpegURL',
    'unofficial.plsPlaylist': 'audio/scpls',
    'unofficial.rdfFeed': 'application/rdf+xml',
    'unofficial.rssFeed': 'application/rss+xml',
  }

  utiRevDefs: { [key: string]: string } = {
    ...this.compatUtiRevDefs,
    'com.adobe.encapsulated-postscript': 'image/eps',
    'com.adobe.illustrator.ai-image': 'application/illustrator',
    'com.adobe.indesign-image': 'image/indesign',
    'com.adobe.pdf': 'application/pdf',
    'com.adobe.photoshop-image': 'image/psd',
    'com.adobe.postscript': 'application/postscript',
    'com.adobe.postscript-pfa-font': 'application/x-font-type1',
    'com.adobe.postscript-pfb-font': 'application/x-font-type1',
    'com.allume.stuffit-archive': 'application/stuffit',
    'com.apple.applescript.script': 'application/x-applescript',
    'com.apple.applescript.text': 'application/x-applescript',
    'com.apple.binhex-archive': 'application/binhex',
    'com.apple.disk-image-udif': 'application/x-apple-diskimage',
    'com.apple.ical.ics': 'text/calendar',
    'com.apple.ical.vcs': 'text/x-vcalendar',
    'com.apple.macbinary-archive': 'application/macbinary',
    'com.apple.pict': 'image/pict',
    'com.apple.quartz-composer-composition': 'application/x-quartzcomposer',
    'com.apple.quicktime-image': 'image/x-quicktime',
    'com.apple.quicktime-movie': 'video/quicktime',
    'com.bittorrent.torrent': 'application/x-bittorrent',
    'com.compuserve.gif': 'image/gif',
    'com.js.efx-fax': 'image/efax',
    'com.kodak.flashpix.image': 'image/vndfpx',
    'com.lizardtech.djvu': 'image/vnd.djvu',
    'com.macromedia.shockwave-flash': 'application/x-shockwave-flash',
    'com.microsoft.advanced-stream-redirector': 'video/x-ms-asx',
    'com.microsoft.advanced-systems-format': 'video/x-ms-asf',
    'com.microsoft.bmp': 'image/bmp',
    'com.microsoft.excel.xls': 'application/excel',
    'com.microsoft.ico': 'image/x-icon',
    'com.microsoft.powerpoint.ppt': 'application/powerpoint',
    'com.microsoft.waveform-audio': 'audio/wave',
    'com.microsoft.windows-dynamic-link-library': 'application/x-msdownload',
    'com.microsoft.windows-executable': 'application/exe',
    'com.microsoft.windows-media-wax': 'audio/x-ms-wax',
    'com.microsoft.windows-media-wm': 'video/x-ms-wm',
    'com.microsoft.windows-media-wma': 'audio/x-ms-wma',
    'com.microsoft.windows-media-wmd': 'video/x-ms-wmd',
    'com.microsoft.windows-media-wmp': 'video/x-ms-wmp',
    'com.microsoft.windows-media-wmv': 'video/x-ms-wmv',
    'com.microsoft.windows-media-wmx': 'video/x-ms-wmx',
    'com.microsoft.windows-media-wmz': 'video/x-ms-wmz',
    'com.microsoft.windows-media-wvx': 'video/x-ms-wvx',
    'com.microsoft.word.doc': 'application/msword',
    'com.netscape.javascript-source': 'text/javascript',
    'com.pkware.zip-archive': 'application/zip',
    'com.rarlab.rar-archive': 'application/rar',
    'com.real.realaudio': 'audio/vnd.rn-realaudio',
    'com.real.realmedia': 'application/vnd.rn-realmedia',
    'com.real.smil': 'application/smil',
    'com.redhat.redhat-package': 'application/x-redhat-package',
    'com.sgi.sgi-image': 'image/sgi',
    'com.soundblaster.soundfont': 'application/x-soundfont',
    'com.sun.java-app-descriptor': 'text/vnd.sun.j2me.app-descriptor',
    'com.sun.java-archive': 'application/java-archive',
    'com.sun.java-class': 'application/java',
    'com.sun.java-source': 'text/x-java-source',
    'com.sun.java-web-start': 'application/jnlp',
    'com.truevision.tga-image': 'image/tga',
    'org.bzip.bzip2-archive': 'application/x-bzip2',
    'org.debian.debian-package': 'application/x-debian-package',
    'org.gnu.gnu-tar-archive': 'application/x-gtar',
    'org.gnu.gnu-zip-archive': 'application/gzip',
    'org.neooffice.calc': 'application/vnd.sun.xml.calc',
    'org.neooffice.draw': 'application/vnd.sun.xml.draw',
    'org.neooffice.global': 'application/vnd.sun.xml.writer.global',
    'org.neooffice.impress': 'application/vnd.sun.xml.impress',
    'org.neooffice.math': 'application/vnd.sun.xml.math',
    'org.neooffice.writer': 'application/vnd.sun.xml.writer',
    'org.oasis.opendocument.chart': 'application/vnd.oasis.opendocument.chart',
    'org.oasis.opendocument.database': 'application/vnd.oasis.opendocument.database',
    'org.oasis.opendocument.formula': 'application/vnd.oasis.opendocument.formula',
    'org.oasis.opendocument.graphics': 'application/vnd.oasis.opendocument.graphics',
    'org.oasis.opendocument.image': 'application/vnd.oasis.opendocument.image',
    'org.oasis.opendocument.presentation': 'application/vnd.oasis.opendocument.presentation',
    'org.oasis.opendocument.spreadsheet': 'application/vnd.oasis.opendocument.spreadsheet',
    'org.oasis.opendocument.text': 'application/vnd.oasis.opendocument.text',
    'org.oasis.opendocument.text-master': 'application/vnd.oasis.opendocument.text-master',
    'org.oasis.opendocument.text-web': 'application/vnd.oasis.opendocument.text-web',
    'org.tug.tex': 'text/tex',
    'org.xiph.flac': 'audio/flac',
    'org.xiph.ogg-theora': 'video/ogg',
    'org.xiph.ogg-vorbis': 'audio/ogg',
    'public.3gpp': 'video/3gpp',
    'public.3gpp2': 'video/3gpp2',
    'public.aifc-audio': 'audio/aiff',
    'public.aiff-audio': 'audio/aiff',
    'public.assembly-source': 'text/x-asm',
    'public.avi': 'video/avi',
    'public.c-header': 'text/x-c-header',
    'public.cpio-archive': 'application/x-cpio',
    'public.c-plus-plus-header': 'text/x-c++-hdr',
    'public.c-plus-plus-source': 'application/x-cplusplus',
    'public.csh-script': 'application/x-csh',
    'public.c-source': 'text/x-c-code',
    'public.css': 'text/css',
    'public.dv': 'video/x-dv',
    'public.flv': 'video/x-flv',
    'public.html': 'text/html',
    'public.iso-image': 'application/x-iso-image',
    'public.jpeg': 'image/jpeg',
    'public.jpeg2000': 'image/jp2',
    'public.midi': 'audio/midi',
    'public.mka': 'audio/x-matroska',
    'public.mkv': 'video/x-matroska',
    'public.mp3': 'audio/mp3',
    'public.mpeg': 'video/mpeg',
    'public.mpeg4': 'video/mp4',
    'public.mpeg4-audio': 'audio/mp4',
    'public.mpegts': 'video/MP2T',
    'public.objective-c-plus-plus-source': 'text/x-objcppsrc',
    'public.objective-c-source': 'text/x-objcsrc',
    'public.opentype-font': 'font/opentype',
    'public.perl-script': 'text/x-perl',
    'public.php-script': 'text/php',
    'public.plain-text': 'text/plain',
    'public.png': 'image/png',
    'public.python-script': 'text/x-python-script',
    'public.rtf': 'text/rtf',
    'public.shell-script': 'application/x-sh',
    'public.tar-archive': 'application/tar',
    'public.tiff': 'image/tiff',
    'public.truetype-ttf-font': 'application/x-font-ttf',
    'public.ulaw-audio': 'audio/au',
    'public.vcard': 'text/vcard',
    'public.webm': 'video/webm',
    'public.xbitmap-image': 'image/xbm',
    'public.xml': 'text/xml',
    'unofficial.atom-feed': 'application/atom+xml',
    'unofficial.m3u8-playlist': 'application/x-mpegURL',
    'unofficial.opml': 'text/x-opml',
    'unofficial.pls-playlist': 'audio/scpls',
    'unofficial.rdf-feed': 'application/rdf+xml',
    'unofficial.rss-feed': 'application/rss+xml',
  }

  utiExts: { [key: string]: string } = {
    jpg: 'public.jpeg',
    jpeg: 'public.jpeg',
    png: 'public.png',
    rtf: 'public.rtf',
    mpeg: 'public.mpeg',
    mpg: 'public.mpeg',
    html: 'public.html',
    htm: 'public.html',
    pdf: 'com.adobe.pdf',
    xls: 'com.microsoft.excel.xls',
    xlsx: 'com.microsoft.excel.xls',
    doc: 'com.microsoft.word.doc',
    docx: 'com.microsoft.word.doc',
  }

  utiDefs: { [key: string]: string } = {
    'application/atom+xml': 'unofficial.atom-feed',
    'application/bat': 'com.microsoft.windows-executable',
    'application/binhex': 'com.apple.binhex-archive',
    'application/binhex4': 'com.apple.binhex-archive',
    'application/ecmascript': 'com.netscape.javascript-source',
    'application/eps': 'com.adobe.encapsulated-postscript',
    'application/excel': 'com.microsoft.excel.xls',
    'application/exe': 'com.microsoft.windows-executable',
    'application/gnutar': 'public.tar-archive',
    'application/gzip': 'org.gnu.gnu-zip-archive',
    'application/illustrator': 'com.adobe.illustrator.ai-image',
    'application/indesign': 'com.adobe.indesign-image',
    'application/java-archive': 'com.sun.java-archive',
    'application/java-byte-code': 'com.sun.java-class',
    'application/java': 'com.sun.java-class',
    'application/javascript': 'com.netscape.javascript-source',
    'application/jnlp': 'com.sun.java-web-start',
    'application/latex': 'org.tug.tex',
    'application/mac-binary': 'com.apple.macbinary-archive',
    'application/mac-binhex': 'com.apple.binhex-archive',
    'application/mac-binhex40': 'com.apple.binhex-archive',
    'application/macbinary': 'com.apple.macbinary-archive',
    'application/mspowerpoint': 'com.microsoft.powerpoint.ppt',
    'application/msword': 'com.microsoft.word.doc',
    'application/octet-stream': 'com.microsoft.windows-executable',
    'application/pdf': 'com.adobe.pdf',
    'application/photoshop': 'com.adobe.photoshop-image',
    'application/php': 'public.php-script',
    'application/plain': 'public.plain-text',
    'application/postscript': 'com.adobe.postscript',
    'application/powerpoint': 'com.microsoft.powerpoint.ppt',
    'application/rar': 'com.rarlab.rar-archive',
    'application/rdf+xml': 'unofficial.rdf-feed',
    'application/rss+xml': 'unofficial.rss-feed',
    'application/rtf': 'public.rtf',
    'application/smil': 'com.real.smil',
    'application/stuffit': 'com.allume.stuffit-archive',
    'application/tar': 'public.tar-archive',
    'application/tga': 'com.truevision.tga-image',
    'application/vnd.fpx': 'com.kodak.flashpix.image',
    'application/vnd.ms-excel': 'com.microsoft.excel.xls',
    'application/vnd.ms-powerpoint': 'com.microsoft.powerpoint.ppt',
    'application/vnd.oasis.opendocument.chart': 'org.oasis.opendocument.chart',
    'application/vnd.oasis.opendocument.database': 'org.oasis.opendocument.database',
    'application/vnd.oasis.opendocument.formula': 'org.oasis.opendocument.formula',
    'application/vnd.oasis.opendocument.graphics-template': 'org.oasis.opendocument.graphics',
    'application/vnd.oasis.opendocument.graphics': 'org.oasis.opendocument.graphics',
    'application/vnd.oasis.opendocument.image': 'org.oasis.opendocument.image',
    'application/vnd.oasis.opendocument.presentation-template': 'org.oasis.opendocument.presentation',
    'application/vnd.oasis.opendocument.presentation': 'org.oasis.opendocument.presentation',
    'application/vnd.oasis.opendocument.spreadsheet-template': 'org.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.spreadsheet': 'org.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.text-master': 'org.oasis.opendocument.text-master',
    'application/vnd.oasis.opendocument.text-template': 'org.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.text-web': 'org.oasis.opendocument.text-web',
    'application/vnd.oasis.opendocument.text': 'org.oasis.opendocument.text',
    'application/vnd.rn-realmedia': 'com.real.realmedia',
    'application/vnd.sun.xml.calc.template': 'org.neooffice.calc',
    'application/vnd.sun.xml.calc': 'org.neooffice.calc',
    'application/vnd.sun.xml.draw.template': 'org.neooffice.draw',
    'application/vnd.sun.xml.draw': 'org.neooffice.draw',
    'application/vnd.sun.xml.impress.template': 'org.neooffice.impress',
    'application/vnd.sun.xml.impress': 'org.neooffice.impress',
    'application/vnd.sun.xml.math': 'org.neooffice.math',
    'application/vnd.sun.xml.writer.global': 'org.neooffice.global',
    'application/vnd.sun.xml.writer.template': 'org.neooffice.writer',
    'application/vnd.sun.xml.writer': 'org.neooffice.writer',
    'application/vndms-excel': 'com.microsoft.excel.xls',
    'application/vndms-powerpoint': 'com.microsoft.powerpoint.ppt',
    'application/vndrn-realmedia': 'com.real.realmedia',
    'application/x-apple-diskimage': 'com.apple.disk-image-udif',
    'application/x-applescript': 'com.apple.applescript.script',
    'application/x-bat': 'com.microsoft.windows-executable',
    'application/x-binary': 'com.apple.macbinary-archive',
    'application/x-binhex40': 'com.apple.binhex-archive',
    'application/x-bittorrent': 'com.bittorrent.torrent',
    'application/x-bzip2': 'org.bzip.bzip2-archive',
    'application/x-cpio': 'public.cpio-archive',
    'application/x-cplusplus': 'public.c-plus-plus-source',
    'application/x-csh': 'public.csh-script',
    'application/x-deb': 'org.debian.debian-package',
    'application/x-debian-package': 'org.debian.debian-package',
    'application/x-eps': 'com.adobe.encapsulated-postscript',
    'application/x-excel': 'com.microsoft.excel.xls',
    'application/x-exe': 'com.microsoft.windows-executable',
    'application/x-flac': 'org.xiph.flac',
    'application/x-font-ttf': 'public.truetype-ttf-font',
    'application/x-font-type1': 'com.adobe.postscript-pfa-font',
    'application/x-gtar': 'org.gnu.gnu-tar-archive',
    'application/x-gzip': 'org.gnu.gnu-zip-archive',
    'application/x-iso-image': 'public.iso-image',
    'application/x-java-class': 'com.sun.java-class',
    'application/x-java': 'com.sun.java-web-start',
    'application/x-javascript': 'com.netscape.javascript-source',
    'application/x-latex': 'org.tug.tex',
    'application/x-mac-binhex40': 'com.apple.binhex-archive',
    'application/x-macbinary': 'com.apple.macbinary-archive',
    'application/x-midi': 'public.midi',
    'application/x-mpegURL': 'unofficial.m3u8-playlist',
    'application/x-ms-wmd': 'com.microsoft.windows-media-wmd',
    'application/x-ms-wmz': 'com.microsoft.windows-media-wmz',
    'application/x-msdos-program': 'com.microsoft.windows-executable',
    'application/x-msdownload': 'com.microsoft.windows-executable',
    'application/x-msexcel': 'com.microsoft.excel.xls',
    'application/x-mspowerpoint': 'com.microsoft.powerpoint.ppt',
    'application/x-pdf': 'com.adobe.pdf',
    'application/x-perl': 'public.perl-script',
    'application/x-php': 'public.php-script',
    'application/x-quartzcomposer': 'com.apple.quartz-composer-composition',
    'application/x-rar-compressed': 'com.rarlab.rar-archive',
    'application/x-redhat-package': 'com.redhat.redhat-package',
    'application/x-rpm': 'com.redhat.redhat-package',
    'application/x-rtf': 'public.rtf',
    'application/x-sh': 'public.shell-script',
    'application/x-shellscript': 'public.shell-script',
    'application/x-shockwave-flash': 'com.macromedia.shockwave-flash',
    'application/x-sit': 'com.allume.stuffit-archive',
    'application/x-smil': 'com.real.smil',
    'application/x-soundfont': 'com.soundblaster.soundfont',
    'application/x-stuffit': 'com.allume.stuffit-archive',
    'application/x-tar': 'public.tar-archive',
    'application/x-tex': 'org.tug.tex',
    'application/x-texinfo': 'org.tug.tex',
    'application/x-troff-msvideo': 'public.avi',
    'application/x-zip-compressed': 'com.pkware.zip-archive',
    'application/xhtml+xml': 'public.html',
    'application/xml': 'public.xml',
    'application/zip': 'com.pkware.zip-archive',
    'audio/3gpp': 'public.3gpp',
    'audio/3gpp2': 'public.3gpp2',
    'audio/aiff': 'public.aiff-audio',
    'audio/au': 'public.ulaw-audio',
    'audio/basic': 'public.ulaw-audio',
    'audio/flac': 'org.xiph.flac',
    'audio/mid': 'public.midi',
    'audio/midi': 'public.midi',
    'audio/mp3': 'public.mp3',
    'audio/mp4': 'public.mpeg4-audio',
    'audio/mp4a-latm': 'public.mpeg4-audio',
    'audio/mpeg': 'public.mp3',
    'audio/mpeg3': 'public.mp3',
    'audio/mpegurl': 'unofficial.m3u-playlist',
    'audio/mpg': 'public.mp3',
    'audio/ogg': 'org.xiph.ogg-vorbis',
    'audio/scpls': 'unofficial.pls-playlist',
    'audio/snd': 'public.ulaw-audio',
    'audio/vnd.rn-realaudio': 'com.real.realaudio',
    'audio/wav': 'com.microsoft.waveform-audio',
    'audio/wave': 'com.microsoft.waveform-audio',
    'audio/webm': 'public.webm',
    'audio/x-adpcm': 'public.ulaw-audio',
    'audio/x-aiff': 'public.aiff-audio',
    'audio/x-au': 'public.ulaw-audio',
    'audio/x-flac': 'org.xiph.flac',
    'audio/x-matroska': 'public.mka',
    'audio/x-mid': 'public.midi',
    'audio/x-midi': 'public.midi',
    'audio/x-mp3': 'public.mp3',
    'audio/x-mpeg-3': 'public.mp3',
    'audio/x-mpeg': 'public.mp3',
    'audio/x-mpeg3': 'public.mp3',
    'audio/x-mpegurl': 'unofficial.m3u-playlist',
    'audio/x-mpg': 'public.mp3',
    'audio/x-ms-wax': 'com.microsoft.windows-media-wax',
    'audio/x-ms-wma': 'com.microsoft.windows-media-wma',
    'audio/x-ogg': 'org.xiph.ogg-vorbis',
    'audio/x-pn-realaudio-plugin': 'com.real.realaudio',
    'audio/x-pn-realaudio': 'com.real.realaudio',
    'audio/x-pn-wav': 'com.microsoft.waveform-audio',
    'audio/x-realaudio': 'com.real.realmedia',
    'audio/x-scpls': 'unofficial.pls-playlist',
    'audio/x-wav': 'com.microsoft.waveform-audio',
    'font/opentype': 'public.opentype-font',
    'image/bmp': 'com.microsoft.bmp',
    'image/efax': 'com.js.efx-fax',
    'image/eps': 'com.adobe.encapsulated-postscript',
    'image/fpx': 'com.kodak.flashpix.image',
    'image/gif': 'com.compuserve.gif',
    'image/indd': 'com.adobe.indesign-image',
    'image/indesign': 'com.adobe.indesign-image',
    'image/jp2': 'public.jpeg2000',
    'image/jpeg': 'public.jpeg',
    'image/ms-bmp': 'com.microsoft.bmp',
    'image/photoshop': 'com.adobe.photoshop-image',
    'image/pict': 'com.apple.pict',
    'image/pipeg': 'public.jpeg',
    'image/pjpeg': 'public.jpeg',
    'image/png': 'public.png',
    'image/psd': 'com.adobe.photoshop-image',
    'image/sgi': 'com.sgi.sgi-image',
    'image/targa': 'com.truevision.tga-image',
    'image/tga': 'com.truevision.tga-image',
    'image/tiff': 'public.tiff',
    'image/vnd.djvu': 'com.lizardtech.djvu',
    'image/vndfpx': 'com.kodak.flashpix.image',
    'image/vndnet-fpx': 'com.kodak.flashpix.image',
    'image/webp': 'public.webp',
    'image/x-bitmap': 'com.microsoft.bmp',
    'image/x-bmp': 'com.microsoft.bmp',
    'image/x-djvu': 'com.lizardtech.djvu',
    'image/x-eps': 'com.adobe.encapsulated-postscript',
    'image/x-icon': 'com.microsoft.ico',
    'image/x-indesign': 'com.adobe.indesign-image',
    'image/x-macpict': 'com.apple.pict',
    'image/x-ms-bmp': 'com.microsoft.bmp',
    'image/x-photoshop': 'com.adobe.photoshop-image',
    'image/x-pict': 'com.apple.pict',
    'image/x-quicktime': 'com.apple.quicktime-image',
    'image/x-tiff': 'public.tiff',
    'image/x-windows-bmp': 'com.microsoft.bmp',
    'image/x-xbitmap': 'com.microsoft.bmp',
    'image/x-xbm': 'public.xbitmap-image',
    'image/xbm': 'public.xbitmap-image',
    'multipart/x-gzip': 'org.gnu.gnu-zip-archive',
    'multipart/x-zip': 'com.pkware.zip-archive',
    'music/crescendo': 'public.midi',
    'text/calendar': 'com.apple.ical.ics',
    'text/css': 'public.css',
    'text/directory': 'public.vcard',
    'text/ecmascript': 'com.netscape.javascript-source',
    'text/html': 'public.html',
    'text/javascript': 'com.netscape.javascript-source',
    'text/php': 'public.php-script',
    'text/plain': 'public.plain-text',
    'text/richtext': 'public.rtf',
    'text/rtf': 'public.rtf',
    'text/ruby-script': 'public.ruby-script',
    'text/tex': 'org.tug.tex',
    'text/vcard': 'public.vcard',
    'text/vnd.sun.j2me.app-descriptor': 'com.sun.java-app-descriptor',
    'text/x-asm': 'public.assembly-source',
    'text/x-c-code': 'public.c-source',
    'text/x-c-header': 'public.c-header',
    'text/x-c': 'public.c-source',
    'text/x-c++-code': 'public.c-plus-plus-source',
    'text/x-c++-hdr': 'public.c-plus-plus-header',
    'text/x-c++-src': 'public.c-plus-plus-source',
    'text/x-c++src': 'public.c-plus-plus-source',
    'text/x-h': 'public.c-header',
    'text/x-java-source': 'com.sun.java-source',
    'text/x-latex': 'org.tug.tex',
    'text/x-objcppsrc': 'public.objective-c-plus-plus-source',
    'text/x-objcsrc': 'public.objective-c-source',
    'text/x-opml': 'unofficial.opml',
    'text/x-perl-script': 'public.perl-script',
    'text/x-perl': 'public.perl-script',
    'text/x-php-script': 'public.php-script',
    'text/x-python-script': 'public.python-script',
    'text/x-python': 'public.python-script',
    'text/x-scriptcsh': 'public.csh-script',
    'text/x-scriptperl-module': 'public.perl-script',
    'text/x-scriptperl': 'public.perl-script',
    'text/x-scriptphyton': 'public.python-script',
    'text/x-scriptsh': 'public.shell-script',
    'text/x-server-parsed-html': 'public.html',
    'text/x-tex': 'org.tug.tex',
    'text/x-vcalendar': 'com.apple.ical.vcs',
    'text/x-vcard': 'public.vcard',
    'text/xhtml': 'public.html',
    'text/xml': 'public.xml',
    'video/3gpp': 'public.3gpp',
    'video/3gpp2': 'public.3gpp2',
    'video/avi': 'public.avi',
    'video/MP2T': 'public.mpegts',
    'video/mp4': 'public.mpeg4',
    'video/mp4v': 'public.mpeg4',
    'video/mpeg': 'public.mpeg',
    'video/mpg': 'public.mpeg',
    'video/msvideo': 'public.avi',
    'video/ogg': 'org.xiph.ogg-theora',
    'video/quicktime': 'com.apple.quicktime-movie',
    'video/webm': 'public.webm',
    'video/x-dv': 'public.dv',
    'video/x-flv': 'public.flv',
    'video/x-m4v': 'public.mpeg4',
    'video/x-matroska': 'public.mkv',
    'video/x-mpeg': 'public.mpeg',
    'video/x-mpg': 'public.mpeg',
    'video/x-ms-asf-plugin': 'com.microsoft.advanced-systems-format',
    'video/x-ms-asf': 'com.microsoft.advanced-systems-format',
    'video/x-ms-asx': 'com.microsoft.advanced-stream-redirector',
    'video/x-ms-wm': 'com.microsoft.windows-media-wm',
    'video/x-ms-wmd': 'com.microsoft.windows-media-wmd',
    'video/x-ms-wmp': 'com.microsoft.windows-media-wmp',
    'video/x-ms-wmv': 'com.microsoft.windows-media-wmv',
    'video/x-ms-wmx': 'com.microsoft.windows-media-wmx',
    'video/x-ms-wmz': 'com.microsoft.windows-media-wmz',
    'video/x-ms-wvx': 'com.microsoft.windows-media-wvx',
    'video/x-msvideo': 'public.avi',
    'video/x-ogg': 'org.xiph.ogg-theora',
    'x-msdos-program': 'com.microsoft.windows-executable',
    'x-music/x-midi': 'public.midi',
  }
  dataOwnerApi: IccDataOwnerXApi
  authenticationProvider: AuthenticationProvider

  constructor(
    host: string,
    headers: { [key: string]: string },
    private crypto: IccCryptoXApi,
    private authApi: IccAuthApi,
    dataOwnerApi: IccDataOwnerXApi,
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
    this.fetchImpl = fetchImpl
    this.authenticationProvider = authenticationProvider
    this.dataOwnerApi = dataOwnerApi
  }

  /**
   * Creates a new instance of document with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param message the message this document refers to.
   * @param c initialised data for the document. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used.
   * - preferredSfk: secret id of the message to use as the secret foreign key to use for the document. The default value will be a
   * secret id of the message known by the topmost parent in the current data owner hierarchy.
   * @return a new instance of document.
   */
  async newInstance(
    user: models.User,
    message?: models.Message,
    c: any = {},
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      preferredSfk?: string
    } = {}
  ) {
    if (!message && options.preferredSfk) throw new Error('You need to specify parent message in order to use secret foreign keys.')
    const document = _.extend(
      {
        id: this.crypto.primitives.randomUuid(),
        _type: 'org.taktik.icure.entities.Document',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.dataOwnerApi.getDataOwnerIdOf(user),
        author: user.id,
        codes: [],
        tags: [],
      },
      c
    )

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk = message
      ? options.preferredSfk ?? (await this.crypto.confidential.getAnySecretIdSharedWithParents({ entity: message, type: 'Message' }))
      : undefined
    if (message && !sfk) throw new Error(`Couldn't find any sfk of parent message ${message.id}`)
    const extraDelegations = {
      ...Object.fromEntries(
        [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])].map((d) => [d, AccessLevelEnum.WRITE])
      ),
      ...(options?.additionalDelegates ?? {}),
    }
    return new models.Document(
      await this.crypto.xapi
        .entityWithInitialisedEncryptedMetadata(document, 'Document', message?.id, sfk, true, false, extraDelegations)
        .then((x) => x.updatedEntity)
    )
  }

  // noinspection JSUnusedGlobalSymbols
  async findByMessage(hcpartyId: string, message: models.Message) {
    const extractedKeys = await this.crypto.xapi.secretIdsOf({ entity: message, type: 'Message' }, hcpartyId)
    const topmostParentId = (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0]
    let documents: Array<models.Document> = await this.findDocumentsByHCPartyPatientForeignKeys(topmostParentId, _.uniq(extractedKeys).join(','))
    return await this.decrypt(hcpartyId, documents)
  }

  // Note: this is only for dealing with legacy documents: new document are not encrypted, only their attachments are
  decrypt(hcpartyId: string, documents: Array<models.Document>): Promise<Array<models.Document>> {
    return Promise.all(
      documents.map((document) =>
        this.crypto.xapi.decryptAndImportAllDecryptionKeys({ entity: document, type: 'Document' }).then((keys) => {
          if (!keys.length) {
            console.log('Cannot decrypt document', document.id)
            return Promise.resolve(document)
          }

          if (keys.length && (document.encryptedSelf || document.encryptedAttachment)) {
            const key = keys[0].key
            return Promise.all([
              document.encryptedSelf
                ? new Promise((resolve: (value: ArrayBuffer | null) => any) => {
                    this.crypto.primitives.AES.decrypt(key, string2ua(a2b(document.encryptedSelf!))).then(resolve, () => {
                      console.log('Cannot decrypt document', document.id)
                      resolve(null)
                    })
                  })
                : Promise.resolve(null),
              document.encryptedAttachment
                ? new Promise((resolve: (value: ArrayBuffer | null) => any) => {
                    this.crypto.primitives.AES.decrypt(key, document.encryptedAttachment!).then(resolve, () => {
                      console.log('Cannot decrypt document', document.id)
                      resolve(null)
                    })
                  })
                : Promise.resolve(null),
            ]).then((decrypted: [ArrayBuffer | null, ArrayBuffer | null]) => {
              if (decrypted) {
                if (decrypted[0]) {
                  document = _.extend(document, JSON.parse(ua2string(decrypted[0])))
                }
                if (decrypted[1]) {
                  document.decryptedAttachment = decrypted[1]
                }
              }
              return document
            })
          } else {
            return Promise.resolve(document)
          }
        })
      )
    ).catch(function (e: Error) {
      console.log(e)
      return Promise.resolve(documents)
    })
  }

  //prettier-ignore
  getAttachmentAs(documentId: string, attachmentId: string, returnType: "application/octet-stream", enckeys?: string, fileName?: string): Promise<ArrayBuffer>
  //prettier-ignore
  getAttachmentAs(documentId: string, attachmentId: string, returnType: "text/plain", enckeys?: string, fileName?: string): Promise<string>
  //prettier-ignore
  getAttachmentAs(documentId: string, attachmentId: string, returnType: "application/json", enckeys?: string, fileName?: string): Promise<any>
  getAttachmentAs(
    documentId: string,
    attachmentId: string,
    returnType: 'application/octet-stream' | 'text/plain' | 'application/json',
    enckeys?: string,
    fileName?: string
  ): Promise<any> {
    const url =
      this.host +
      `/document/${documentId}/attachment/${attachmentId}` +
      '?ts=' +
      new Date().getTime() +
      (enckeys ? `&enckeys=${enckeys}` : '') +
      (fileName ? `&fileName=${fileName}` : '')
    return XHR.sendCommand('GET', url, this.headers, null, this.fetchImpl, returnType, this.authenticationProvider.getAuthService())
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  // noinspection JSUnusedGlobalSymbols
  getAttachmentUrl(documentId: string, attachmentId: string, sfks: Array<{ delegatorId: string; key: CryptoKey }>, fileName?: string) {
    return this.authApi
      .token('GET', `/rest/v1/document/${documentId}/attachment/${attachmentId}`)
      .then(
        (token) =>
          this.host +
          `/document/${documentId}/attachment/${attachmentId}${token ? `;tokenid=${token}` : ''}` +
          (sfks && sfks.length ? '?enckeys=' + sfks.join(',') : '') +
          (fileName && fileName.length ? `${sfks && sfks.length ? '&' : '?'}fileName=${encodeURIComponent(fileName)}` : '')
      )
  }

  // noinspection JSUnusedGlobalSymbols
  uti(mimeType: string, extension: string) {
    return (mimeType && mimeType !== 'application/octet-stream' ? this.utiDefs[mimeType] : this.utiExts[extension]) || this.utiDefs[mimeType]
  }

  // noinspection JSUnusedGlobalSymbols
  mimeType(uti: string) {
    return this.utiRevDefs[uti]
  }

  /**
   * Adds an attachment to a document, encrypting it on client side using the encryption keys of the provided document.
   * @param document a document.
   * @param attachment a new main attachment for the document.
   * @return the updated document.
   */
  async encryptAndSetDocumentAttachment(document: models.Document, attachment: ArrayBuffer | Uint8Array): Promise<models.Document> {
    const encryptedData = await this.crypto.xapi.encryptDataOf({ entity: document, type: 'Document' }, attachment)
    if (!document.rev) throw new Error('Cannot set attachment on document without rev')
    return await this.setMainDocumentAttachment(document.id!, document.rev, encryptedData)
  }

  /**
   * Adds an unencrypted attachment to a document.
   * @param document a document.
   * @param attachment a new main attachment for the document.
   * @return the updated document.
   */
  async setClearDocumentAttachment(document: models.Document, attachment: ArrayBuffer | Uint8Array): Promise<models.Document> {
    if (!document.rev) throw new Error('Cannot set attachment on document without rev')
    return await this.setMainDocumentAttachment(document.id!, document.rev, attachment)
  }

  /**
   * Adds a secondary attachment to a document, encrypting it on client side using the encryption keys of the provided document.
   * @param document a document.
   * @param secondaryAttachmentKey key for the secondary attachment.
   * @param attachment a new secondary attachment for the document.
   * @return the updated document.
   */
  async encryptAndSetSecondaryDocumentAttachment(
    document: models.Document,
    secondaryAttachmentKey: string,
    attachment: ArrayBuffer | Uint8Array
  ): Promise<models.Document> {
    const encryptedData = await this.crypto.xapi.encryptDataOf({ entity: document, type: 'Document' }, attachment)
    return await this.setSecondaryAttachment(document.id!, secondaryAttachmentKey, document.rev!, encryptedData)
  }

  /**
   * Adds an unencrypted secondary attachment to a document.
   * @param document a document.
   * @param secondaryAttachmentKey key for the secondary attachment.
   * @param attachment a new secondary attachment for the document.
   * @return the updated document.
   */
  async setClearSecondaryDocumentAttachment(
    document: models.Document,
    secondaryAttachmentKey: string,
    attachment: ArrayBuffer | Uint8Array
  ): Promise<models.Document> {
    return await this.setSecondaryAttachment(document.id!, secondaryAttachmentKey, document.rev!, attachment)
  }

  /**
   * Gets the main attachment of a document and tries to decrypt it using the encryption keys of the document, throwing an error if the operation fails.
   * @param document a document.
   * @param validator optionally a validator function which checks if the decryption was successful. In cases where the document has many encryption
   * keys and it is unclear which one should be used this function can help to detect bad decryptions.
   * @return the decrypted attachment, if it could be decrypted, else the encrypted attachment.
   */
  async getAndDecryptDocumentAttachment(
    document: models.Document,
    validator: (decrypted: ArrayBuffer) => Promise<boolean> = () => Promise.resolve(true)
  ): Promise<ArrayBuffer> {
    const retrieved = await this.getAndTryDecryptDocumentAttachment(document, (x) => validator(x))
    if (!retrieved.wasDecrypted) throw new Error(`No valid key found to decrypt data of document ${document.id}.`)
    return retrieved.data
  }

  /**
   * Gets the main attachment of a document and tries to decrypt it using the encryption keys of the document.
   * @param document a document.
   * @param validator optionally a validator function which checks if the decryption was successful. In cases where the document has many encryption
   * keys and it is unclear which one should be used this function can help to detect bad decryptions.
   * @return an object containing:
   * - data: the decrypted attachment, if it could be decrypted, else the encrypted attachment.
   * - wasDecrypted: if the data was successfully decrypted or not
   */
  async getAndTryDecryptDocumentAttachment(
    document: models.Document,
    validator: (decrypted: ArrayBuffer) => Promise<boolean> = () => Promise.resolve(true)
  ): Promise<{ data: ArrayBuffer; wasDecrypted: boolean }> {
    return await this.crypto.xapi.tryDecryptDataOf({ entity: document, type: 'Document' }, await this.getMainDocumentAttachment(document.id!), (x) =>
      validator(x)
    )
  }

  /**
   * Gets the secondary attachment of a document and tries to decrypt it using the encryption keys of the document, throwing an error if the operation fails.
   * @param document a document.
   * @param secondaryAttachmentKey key of the secondary attachment.
   * @param validator optionally a validator function which checks if the decryption was successful. In cases where the document has many encryption
   * keys and it is unclear which one should be used this function can help to detect bad decryptions.
   * @return the decrypted attachment.
   */
  async getAndDecryptSecondaryDocumentAttachment(
    document: models.Document,
    secondaryAttachmentKey: string,
    validator: (decrypted: ArrayBuffer) => Promise<boolean> = () => Promise.resolve(true)
  ): Promise<ArrayBuffer> {
    const { data, wasDecrypted } = await this.getAndTryDecryptSecondaryDocumentAttachment(document, secondaryAttachmentKey, (x) => validator(x))
    if (!wasDecrypted) throw new Error(`No valid key found to decrypt data of document ${document.id}.`)
    return data
  }

  /**
   * Gets the secondary attachment of a document and tries to decrypt it using the encryption keys of the document.
   * @param document a document.
   * @param secondaryAttachmentKey key of the secondary attachment.
   * @param validator optionally a validator function which checks if the decryption was successful. In cases where the document has many encryption
   * keys and it is unclear which one should be used this function can help to detect bad decryptions.
   * @return an object containing:
   * - data: the decrypted attachment, if it could be decrypted, else the encrypted attachment.
   * - wasDecrypted: if the data was successfully decrypted or not
   */
  async getAndTryDecryptSecondaryDocumentAttachment(
    document: models.Document,
    secondaryAttachmentKey: string,
    validator: (decrypted: ArrayBuffer) => Promise<boolean> = () => Promise.resolve(true)
  ): Promise<{ data: ArrayBuffer; wasDecrypted: boolean }> {
    return await this.crypto.xapi.tryDecryptDataOf(
      { entity: document, type: 'Document' },
      await this.getSecondaryAttachment(document.id!, secondaryAttachmentKey),
      (x) => validator(x)
    )
  }

  /**
   * @param document a document
   * @return the id of the message that the document refers to, retrieved from the encrypted metadata. Normally there should only be one element
   * in the returned array, but in case of entity merges there could be multiple values.
   */
  async decryptMessageIdOf(document: models.Document): Promise<string[]> {
    return this.crypto.xapi.owningEntityIdsOf({ entity: document, type: 'Document' }, undefined)
  }

  /**
   * @return if the logged data owner has write access to the content of the given document
   */
  async hasWriteAccess(document: models.Document): Promise<boolean> {
    return this.crypto.xapi.hasWriteAccess({ entity: document, type: 'Document' })
  }

  /**
   * Share an existing document with other data owners, allowing them to access the non-encrypted data of the document and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the document.
   * @param document the document to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - shareMessageId: specifies if the id of the message that this document refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWith(
    delegateId: string,
    document: models.Document,
    options: {
      requestedPermissions?: RequestedPermissionEnum
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      shareMessageId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.Document> {
    return this.shareWithMany(document, { [delegateId]: options })
  }
  /**
   * Share an existing document with other data owners, allowing them to access the non-encrypted data of the document and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param document the document to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - shareMessageId: specifies if the id of the message that this document refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity.
   */
  async shareWithMany(
    document: models.Document,
    delegates: {
      [delegateId: string]: {
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        shareMessageId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.Document> {
    return (await this.tryShareWithMany(document, delegates)).updatedEntityOrThrow
  }
  /**
   * Share an existing document with other data owners, allowing them to access the non-encrypted data of the document and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param document the document to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - shareMessageId: specifies if the id of the message that this document refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async tryShareWithMany(
    document: models.Document,
    delegates: {
      [delegateId: string]: {
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        shareMessageId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<ShareResult<models.Document>> {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(document, 'Document')
    const updatedEntity = entityWithEncryptionKey ? await this.modifyDocument(entityWithEncryptionKey) : document
    return this.crypto.xapi
      .simpleShareOrUpdateEncryptedEntityMetadata(
        { entity: updatedEntity, type: 'Document' },
        true,
        Object.fromEntries(
          Object.entries(delegates).map(([delegateId, options]) => [
            delegateId,
            {
              requestedPermissions: options.requestedPermissions,
              shareEncryptionKeys: options.shareEncryptionKey,
              shareOwningEntityIds: options.shareMessageId,
              shareSecretIds: undefined,
            },
          ])
        ),
        (x) => this.bulkShareDocument(x)
      )
      .then((r) => r.mapSuccessAsync((e) => this.decrypt(self, [e]).then((es) => es[0])))
  }
}
