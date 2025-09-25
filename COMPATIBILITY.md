# 📱 Version Requirements

## React Native
- **Minimum: 0.76.0** (New Architecture by default)
- **Works with: 0.76.0+** (All future versions)
- **Latest Tested: 0.81.0**
- **Features:** JSI optimized, Bridgeless mode, Fabric renderer, TurboModules

## iOS
- **Minimum: iOS 11.0** (Released September 2017)
- **Recommended: iOS 13.0+** (Better performance)
- Supports: iPhone, iPad, iPod Touch

## Android
- **Minimum: Android 5.0** (API Level 21, Released 2014)
- **Recommended: Android 7.0+** (API Level 24)
- Supports: Phones, Tablets

## Web Browsers
- **Chrome: 90+** (Released April 2021)
- **Firefox: 88+** (Released April 2021)
- **Safari: 14+** (Released September 2020)
- **Edge: 90+** (Released April 2021)

## Node.js
- **Minimum: 20.0.0** (LTS)
- **Features**: Native ES2023, V8 v11.3, Stable and mature
- **LTS Support**: Until April 2026
- **Why Node 20**: Maximum compatibility, stable, widely adopted

## Dependencies Compatibility

### WatermelonDB
- **Minimum: 0.27.0** (Full JSI support)
- **Recommended: 0.28.0+** (Latest optimizations)
- **Latest Tested: 0.28.0**

### AWS Amplify
- **DataStore: 4.0.0 - 5.x.x**
- **Core: 5.0.0 - 6.x.x**

## Why React Native 0.76 Minimum?

### React Native 0.76+ Benefits
- **New Architecture by DEFAULT** - No configuration needed
- **Bridgeless Mode** - Direct native communication
- **Optimized JSI** - Maximum performance
- **Static Hermes** - Smaller app size, faster startup
- **Fabric Renderer** - Better UI performance
- **TurboModules** - Lazy loading, better memory usage

### iOS 11+
- 98%+ device coverage
- Core Data improvements
- Better SQLite performance
- Modern Swift support

### Android 5.0+
- 98%+ device coverage
- ART runtime (faster than Dalvik)
- Material Design support
- Better SQLite implementation

## Version Feature Matrix

| Feature | RN 0.76+ |
|---------|----------|
| Basic Support | ✅ |
| JSI | ✅ Default & Optimized |
| New Architecture | ✅ Default Enabled |
| Bridgeless Mode | ✅ Available |
| Static Hermes | ✅ Default |
| Performance | **Best** |

## Package.json Configuration

```json
{
  "peerDependencies": {
    "react-native": ">=0.76.0",
    "@aws-amplify/core": "^5.0.0 || ^6.0.0",
    "@aws-amplify/datastore": "^4.0.0 || ^5.0.0",
    "@nozbe/watermelondb": ">=0.27.0"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

## Why 0.76 Minimum?

React Native 0.76 provides:
- ✅ **New Architecture enabled by default** - No setup needed
- ✅ **JSI fully optimized** - Maximum WatermelonDB performance
- ✅ **Bridgeless mode** - Direct native calls
- ✅ **Better memory management** - TurboModules lazy loading
- ✅ **Smaller app size** - Static Hermes

## Testing Matrix

We test on:
- React Native: 0.76, 0.77, 0.81, Latest
- iOS: 13, 15, 17, 18
- Android: 24, 28, 33, 34, 35
- Node: 22, 23

## How to Check Your Versions

```bash
# React Native version
npx react-native --version

# Node version
node --version

# Check iOS deployment target
grep IPHONEOS_DEPLOYMENT_TARGET ios/*.xcodeproj/project.pbxproj

# Check Android minSdkVersion
grep minSdkVersion android/build.gradle
```

## Upgrade to 0.76+

### From older React Native versions:
```bash
npx react-native upgrade 0.76.0
# or latest:
npx react-native upgrade
```

### New Architecture is DEFAULT in 0.76+
No configuration needed! It's enabled automatically.

To verify:
```bash
# Check if New Architecture is active
npx react-native info
```

## Summary

**Minimum: React Native 0.76.0**
- New Architecture by default
- Optimized JSI for WatermelonDB
- Best performance out of the box
- No configuration needed

This ensures all users get the **best performance** without any setup!